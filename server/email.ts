import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Campaign Tracker <onboarding@resend.dev>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is required');
  }

  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  try {
    const { client, fromEmail } = getResendClient();
    
    await client.emails.send({
      from: fromEmail || 'Campaign Tracker <onboarding@resend.dev>',
      to: [to],
      subject: 'Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Reset Your Password</h1>
          <p style="color: #666; font-size: 16px;">
            You requested a password reset. Click the button below to create a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${resetLink}" style="color: #3b82f6; word-break: break-all;">${resetLink}</a>
          </p>
        </div>
      `,
    });
    
    console.log(`[EMAIL] Password reset email sent to ${to}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send password reset email:', error);
    throw error;
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  try {
    const { client, fromEmail } = getResendClient();

    await client.emails.send({
      from: fromEmail || 'Campaign Tracker <onboarding@resend.dev>',
      to: [to],
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Verify Your Email</h1>
          <p style="color: #666; font-size: 16px;">
            Thank you for signing up! Please use the following code to verify your email address:
          </p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px;">
            This code will expire in 15 minutes. If you didn't request this code, please ignore this email.
          </p>
        </div>
      `,
    });

    console.log(`[EMAIL] Verification code sent to ${to}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send verification email:', error);
    throw error;
  }
}

export async function sendWorkspaceInviteEmail(
  to: string,
  inviterName: string,
  workspaceName: string,
  role: string,
  inviteToken: string
): Promise<void> {
  try {
    const { client, fromEmail } = getResendClient();
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const inviteUrl = `${appUrl}/invite?token=${inviteToken}`;

    await client.emails.send({
      from: fromEmail || 'Campaign Tracker <onboarding@resend.dev>',
      to: [to],
      subject: "You've been invited to join a workspace on DTTracker",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Workspace Invitation</h1>
          <p style="color: #666; font-size: 16px;">
            <strong>${inviterName}</strong> has invited you to join the workspace "<strong>${workspaceName}</strong>" on DTTracker.
          </p>
          <p style="color: #666; font-size: 16px;">
            You will be added as a <strong>${role}</strong>.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This invitation will expire in 7 days. If you don't have an account yet, you'll be able to sign up after clicking the button.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${inviteUrl}" style="color: #3b82f6; word-break: break-all;">${inviteUrl}</a>
          </p>
        </div>
      `,
    });

    console.log(`[EMAIL] Workspace invite sent to ${to}`);
  } catch (error) {
    console.error('[EMAIL] Failed to send workspace invite email:', error);
    throw error;
  }
}
