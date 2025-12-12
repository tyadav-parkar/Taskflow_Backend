import { transporter } from '../config/email.config.js';
import { Verification_Email_Template, Welcome_Email_Template } from './emailTemplates.js';

export const sendVerificationEmail = async (email: string, verificationCode: string): Promise<boolean> => {
  try {
    const response = await transporter.sendMail({
      from: `"TaskManager" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email Address",
      html: Verification_Email_Template.replace("{verificationCode}", verificationCode)
    });
    console.log('Verification email sent successfully:', response.messageId);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  try {
    const response = await transporter.sendMail({
      from: `"Task Manager" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Our Platform!",
      html: Welcome_Email_Template.replace("{name}", name)
    });
    console.log('Welcome email sent successfully:', response.messageId);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};