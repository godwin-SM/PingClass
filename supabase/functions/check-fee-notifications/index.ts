import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function getDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getRelativeDate(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return getDateKey(date);
}

// Check if notification already exists (dedup within 24h)
async function notificationExists(admin: any, userId: string, type: string, paymentId: string): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .gte("created_at", oneDayAgo)
    .contains("data", { payment_id: paymentId })
    .limit(1);
  return data && data.length > 0;
}

// Create in-app notification
async function createNotification(admin: any, userId: string, type: string, title: string, body: string, data: any): Promise<void> {
  await admin.from("notifications").insert({
    user_id: userId,
    type,
    title,
    body,
    data
  });
}

// Send push notification
async function sendPushNotification(supabaseUrl: string, userId: string, title: string, body: string, type: string, data: any): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "x-supabase-secret": Deno.env.get("INTERNAL_SECRET") ?? ""
      },
      body: JSON.stringify({ user_id: userId, title, body, type, data })
    });
  } catch (e) {
    // Push failed silently — not critical
  }
}

// Send overdue email via Resend
async function sendOverdueEmail(supabaseUrl: string, to: string, parentName: string, childName: string, amount: number, dueDate: string, daysOverdue: number): Promise<void> {
  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return;

    await fetch(`${supabaseUrl}/functions/v1/send-overdue-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "x-supabase-secret": Deno.env.get("INTERNAL_SECRET") ?? ""
      },
      body: JSON.stringify({ to, parentName, childName, amount, dueDate, daysOverdue })
    });
  } catch (e) {
    // Email failed silently — not critical
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // Cron-only: must present the shared INTERNAL_SECRET (see fee_notifications_cron).
    const provided = req.headers.get("x-supabase-secret") ?? "";
    if (!provided || provided !== Deno.env.get("INTERNAL_SECRET")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const today = getDateKey(new Date());
    const results = { reminders: 0, dueToday: 0, overdue: 0, emails: 0 };

    // Get all institutes with their settings
    const { data: institutes } = await admin
      .from("institute_settings")
      .select("institute_id, reminder_days_before, overdue_reminder_enabled, notify_fee_reminders");

    if (!institutes || institutes.length === 0) {
      return json({ success: true, results });
    }

    for (const inst of institutes) {
      if (!inst.notify_fee_reminders) continue;

      const reminderDays = inst.reminder_days_before || 3;

      // 1. Fee reminders (N days before due)
      const reminderDate = getRelativeDate(reminderDays);
      const { data: reminderPayments } = await admin
        .from("payments")
        .select("id, student_id, amount, due_date, batch_id, institute_id")
        .eq("institute_id", inst.institute_id)
        .eq("status", "pending")
        .eq("due_date", reminderDate);

      if (reminderPayments) {
        for (const payment of reminderPayments) {
          // Find linked parents
          const { data: links } = await admin
            .from("parent_student_links")
            .select("parent_id")
            .eq("student_id", payment.student_id);

          if (!links) continue;

          for (const link of links) {
            // Check notification preferences
            const { data: prefs } = await admin
              .from("notification_preferences")
              .select("in_app_enabled, push_enabled, fee_reminders")
              .eq("user_id", link.parent_id)
              .maybeSingle();

            if (prefs && !prefs.fee_reminders) continue;

            // Get student name
            const { data: student } = await admin
              .from("students")
              .select("full_name")
              .eq("id", payment.student_id)
              .maybeSingle();

            const childName = student?.full_name || "Your child";
            const title = `Fee reminder: ₹${payment.amount.toLocaleString("en-IN")} due in ${reminderDays} day${reminderDays > 1 ? "s" : ""}`;
            const body = `${childName}'s fee of ₹${payment.amount.toLocaleString("en-IN")} is due on ${payment.due_date}`;

            // Dedup check
            const exists = await notificationExists(admin, link.parent_id, "fee_reminder", payment.id);
            if (exists) continue;

            // Create in-app notification
            if (!prefs || prefs.in_app_enabled) {
              await createNotification(admin, link.parent_id, "fee_reminder", title, body, {
                payment_id: payment.id,
                student_id: payment.student_id,
                amount: payment.amount,
                due_date: payment.due_date
              });
              results.reminders++;
            }

            // Send push
            if (!prefs || prefs.push_enabled) {
              await sendPushNotification(supabaseUrl, link.parent_id, title, body, "fee_reminder", {
                page: "fees",
                payment_id: payment.id
              });
            }
          }
        }
      }

      // 2. Fees due today
      const { data: todayPayments } = await admin
        .from("payments")
        .select("id, student_id, amount, due_date, batch_id, institute_id")
        .eq("institute_id", inst.institute_id)
        .eq("status", "pending")
        .eq("due_date", today);

      if (todayPayments) {
        for (const payment of todayPayments) {
          const { data: links } = await admin
            .from("parent_student_links")
            .select("parent_id")
            .eq("student_id", payment.student_id);

          if (!links) continue;

          for (const link of links) {
            const { data: prefs } = await admin
              .from("notification_preferences")
              .select("in_app_enabled, push_enabled, fee_due_today")
              .eq("user_id", link.parent_id)
              .maybeSingle();

            if (prefs && !prefs.fee_due_today) continue;

            const { data: student } = await admin
              .from("students")
              .select("full_name")
              .eq("id", payment.student_id)
              .maybeSingle();

            const childName = student?.full_name || "Your child";
            const title = `Fee due today: ₹${payment.amount.toLocaleString("en-IN")}`;
            const body = `${childName}'s fee of ₹${payment.amount.toLocaleString("en-IN")} is due today`;

            const exists = await notificationExists(admin, link.parent_id, "fee_due_today", payment.id);
            if (exists) continue;

            if (!prefs || prefs.in_app_enabled) {
              await createNotification(admin, link.parent_id, "fee_due_today", title, body, {
                payment_id: payment.id,
                student_id: payment.student_id,
                amount: payment.amount,
                due_date: payment.due_date
              });
              results.dueToday++;
            }

            if (!prefs || prefs.push_enabled) {
              await sendPushNotification(supabaseUrl, link.parent_id, title, body, "fee_due_today", {
                page: "fees",
                payment_id: payment.id
              });
            }
          }
        }
      }

      // 3. Overdue fees (if enabled)
      if (inst.overdue_reminder_enabled) {
        const yesterday = getRelativeDate(-1);
        const { data: overduePayments } = await admin
          .from("payments")
          .select("id, student_id, amount, due_date, batch_id, institute_id")
          .eq("institute_id", inst.institute_id)
          .eq("status", "pending")
          .lt("due_date", today);

        if (overduePayments) {
          for (const payment of overduePayments) {
            const { data: links } = await admin
              .from("parent_student_links")
              .select("parent_id")
              .eq("student_id", payment.student_id);

            if (!links) continue;

            const daysOverdue = Math.floor((new Date(today).getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24));

            for (const link of links) {
              const { data: prefs } = await admin
                .from("notification_preferences")
                .select("in_app_enabled, push_enabled, email_enabled, fee_overdue")
                .eq("user_id", link.parent_id)
                .maybeSingle();

              if (prefs && !prefs.fee_overdue) continue;

              const { data: student } = await admin
                .from("students")
                .select("full_name")
                .eq("id", payment.student_id)
                .maybeSingle();

              const { data: parentUser } = await admin
                .from("users")
                .select("full_name, email")
                .eq("id", link.parent_id)
                .maybeSingle();

              const childName = student?.full_name || "Your child";
              const parentName = parentUser?.full_name || "Parent";
              const title = `Overdue: ₹${payment.amount.toLocaleString("en-IN")} fee for ${childName}`;
              const body = `Fee of ₹${payment.amount.toLocaleString("en-IN")} was due on ${payment.due_date} (${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue)`;

              const exists = await notificationExists(admin, link.parent_id, "fee_overdue", payment.id);
              if (exists) continue;

              if (!prefs || prefs.in_app_enabled) {
                await createNotification(admin, link.parent_id, "fee_overdue", title, body, {
                  payment_id: payment.id,
                  student_id: payment.student_id,
                  amount: payment.amount,
                  due_date: payment.due_date,
                  days_overdue: daysOverdue
                });
                results.overdue++;
              }

              if (!prefs || prefs.push_enabled) {
                await sendPushNotification(supabaseUrl, link.parent_id, title, body, "fee_overdue", {
                  page: "fees",
                  payment_id: payment.id
                });
              }

              // Send email for overdue (if enabled)
              if ((!prefs || prefs.email_enabled) && parentUser?.email) {
                await sendOverdueEmail(supabaseUrl, parentUser.email, parentName, childName, payment.amount, payment.due_date, daysOverdue);
                results.emails++;
              }
            }
          }
        }
      }
    }

    return json({ success: true, results });
  } catch (err) {
    return json({ error: "Internal server error" }, 500);
  }
});
