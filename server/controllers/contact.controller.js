import { Resend } from "resend";
import { env } from "../config/env.config.js";

// Email is optional: the contact form reports itself as unavailable without these
const resend = env.resend_api_key ? new Resend(env.resend_api_key) : null;
const CONTACT_INBOX = process.env.CONTACT_EMAIL;
const MAIL_FROM = process.env.MAIL_FROM;

// Escape HTML to prevent XSS in email templates
const escapeHtml = (str) => {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const handleSendMessage = async (req, res) => {
  try {
    if (!resend || !CONTACT_INBOX || !MAIL_FROM) {
      return res
        .status(503)
        .json({ error: "The contact form is not set up on this server" });
    }

    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // Sanitize inputs for HTML email templates
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    await resend.batch.send([
      {
        from: MAIL_FROM,
        to: [CONTACT_INBOX],
        reply_to: email,
        subject: `${safeName} sent a message`,
        html: adminEmailTemplate(safeName, safeEmail, safeSubject, safeMessage),
      },
      {
        from: MAIL_FROM,
        to: email,
        subject: `We received your message`,
        html: userEmailTemplate(safeName, safeEmail, safeSubject, safeMessage),
      },
    ]);
    res.status(200).json({ message: "Message sent succesfully" });
  } catch (error) {
    return res.status(500).json({ error: "Something went wrong from server" });
  }
};

const userEmailTemplate = (name, email, subject, message) => `
  <!DOCTYPE html>
  <html lang="en" style="margin: 0; padding: 0;">
    <head>
      <meta charset="UTF-8" />
      <title>Contact Confirmation</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f2f4f6;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: auto;
          background: #ffffff;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        .btn {
          display: inline-block;
          background-color: #007bff;
          color: #fff;
          text-decoration: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          font-size: 12px;
          color: #888;
          text-align: center;
          margin-top: 30px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <p>Hi <strong>${name}</strong>,</p>

        <p>
          Thank you for contacting us. We’ve received your message and our team will get back to you shortly. Here's a copy of what you submitted:
        </p>

        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>

        <p>
          If this wasn’t you or you need immediate help, feel free to reply directly to this email.
        </p>

        <div class="footer">
          Boli <br />
          This is an automated confirmation. Please do not reply.
        </div>
      </div>
    </body>
  </html>
`;

const adminEmailTemplate = (name, email, subject, message) => `
<!DOCTYPE html>
  <html lang="en" style="margin: 0; padding: 0;">
    <head>
      <meta charset="UTF-8" />
      <title>Contact Confirmation</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f2f4f6;
          margin: 0;
          padding: 20px;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: auto;
          background: #ffffff;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
      </style>
    </head>
    <body>
      <div class="container">
      <p>
          New Contact Form Submission from Boli
        </p>

        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>

      </div>
    </body>
    </html>
`;
