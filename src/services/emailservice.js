// services/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();


const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS 
  }
});

// Email templates
const getApprovalEmailTemplate = (name, userType) => {
  const roleText = userType === 'servian' ? 'Service Provider' : 'Customer';
  
  return {
    subject: '🎉 Welcome! Your Account Has Been Approved',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #22c55e; font-size: 28px; margin: 0;">Congratulations! 🎉</h1>
          </div>
          
          <div style="margin-bottom: 25px;">
            <h2 style="color: #333; font-size: 22px;">Dear ${name},</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We're excited to inform you that your ${roleText} account has been <strong style="color: #22c55e;">approved</strong>!
            </p>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              You can now access all features of our platform and start ${userType === 'servian' ? 'offering your services' : 'booking services'}.
            </p>
          </div>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 25px 0;">
            <h3 style="color: #15803d; margin-top: 0;">What's Next?</h3>
            <ul style="color: #374151; margin: 0; padding-left: 20px;">
              ${userType === 'servian' ? `
                <li>Complete your service profile</li>
                <li>Set your availability and pricing</li>
                <li>Start receiving service requests</li>
              ` : `
                <li>Browse available services</li>
                <li>Book your first service</li>
                <li>Rate and review service providers</li>
              `}
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #22c55e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Login to Your Account
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
              Welcome to our community! If you have any questions, feel free to contact our support team.
            </p>
          </div>
        </div>
      </div>
    `
  };
};

const getRejectionEmailTemplate = (name, reason, userType) => {
  const roleText = userType === 'servian' ? 'Service Provider' : 'Customer';
  
  return {
    subject: 'Action Required: Account Application Update',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #ef4444; font-size: 28px; margin: 0;">Account Application Update</h1>
          </div>
          
          <div style="margin-bottom: 25px;">
            <h2 style="color: #333; font-size: 22px;">Dear ${name},</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Thank you for your interest in joining our platform as a ${roleText}. 
              After reviewing your application, we need you to make some improvements before we can approve your account.
            </p>
          </div>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 25px 0;">
            <h3 style="color: #dc2626; margin-top: 0;">Feedback for Improvement:</h3>
            <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">
              ${reason}
            </p>
          </div>
          
          <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 25px 0;">
            <h3 style="color: #1d4ed8; margin-top: 0;">How to Reapply:</h3>
            <ol style="color: #374151; margin: 0; padding-left: 20px;">
              <li>Address the feedback mentioned above</li>
              <li>Update your profile with the required information</li>
              <li>Resubmit your application for review</li>
            </ol>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/profile/edit" 
               style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Update Your Profile
            </a>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px; margin: 0;">
              We're here to help! If you have any questions about this feedback or need assistance, 
              please don't hesitate to contact our support team.
            </p>
          </div>
        </div>
      </div>
    `
  };
};

// Send approval email
export const sendApprovalEmail = async (email, name, userType = 'user') => {
  try {
    const emailTemplate = getApprovalEmailTemplate(name, userType);
    
    await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });
    
    console.log(`Approval email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending approval email:', error);
    throw error;
  }
};

// Send rejection email
export const sendRejectionEmail = async (email, name, reason, userType = 'user') => {
  try {
    const emailTemplate = getRejectionEmailTemplate(name, reason, userType);
    
    await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    });
    
    console.log(`Rejection email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Error sending rejection email:', error);
    throw error;
  }
};

// Send notification email to admin
export const sendAdminNotification = async (subject, message) => {
  try {
    await transporter.sendMail({
      from: `"${process.env.APP_NAME}" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `[Admin] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>${subject}</h2>
          <p>${message}</p>
          <p><a href="${process.env.FRONTEND_URL}/admin">View Admin Panel</a></p>
        </div>
      `
    });
    
    console.log('Admin notification sent');
    return { success: true };
  } catch (error) {
    console.error('Error sending admin notification:', error);
    throw error;
  }
};