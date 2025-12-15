const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
require('dotenv').config();

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter verification failed:', error);
    } else {
        console.log('✅ Email service is ready to send messages');
    }
});

/**
 * Send welcome email to new users
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.loginUrl - Login URL (optional)
 */
const sendWelcomeEmail = async ({ email, name, loginUrl }) => {
    try {
        const templatePath = path.join(__dirname, '../../templates/emails/welcome.ejs');
        const html = await ejs.renderFile(templatePath, { name, email, loginUrl });

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'TechyJaunt Academy'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🎉 Welcome to TechyJaunt Academy!',
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✉️ Welcome email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Failed to send welcome email:', error);
        throw error;
    }
};

/**
 * Send login notification email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.location - Login location (optional)
 * @param {string} options.device - Device info (optional)
 * @param {string} options.resetPasswordUrl - Reset password URL (optional)
 */
const sendLoginNotification = async ({ email, name, location, device, resetPasswordUrl }) => {
    try {
        const templatePath = path.join(__dirname, '../../templates/emails/login-notification.ejs');
        const html = await ejs.renderFile(templatePath, { 
            name, 
            email, 
            location, 
            device, 
            resetPasswordUrl 
        });

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'TechyJaunt Academy'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔐 New Login Detected - Security Alert',
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✉️ Login notification sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Failed to send login notification:', error);
        throw error;
    }
};

/**
 * Send password reset email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.resetToken - Password reset token
 * @param {string} options.resetUrl - Password reset URL
 * @param {string} options.expiryTime - Token expiry time (optional)
 */
const sendPasswordResetEmail = async ({ email, name, resetToken, resetUrl, expiryTime }) => {
    try {
        const templatePath = path.join(__dirname, '../../templates/emails/forgot-password.ejs');
        const html = await ejs.renderFile(templatePath, { 
            name, 
            email, 
            resetToken, 
            resetUrl, 
            expiryTime 
        });

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'TechyJaunt Academy'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '🔑 Password Reset Request - Action Required',
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✉️ Password reset email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Failed to send password reset email:', error);
        throw error;
    }
};

/**
 * Send password reset success confirmation email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.location - Reset location (optional)
 * @param {string} options.loginUrl - Login URL (optional)
 */
const sendPasswordResetSuccessEmail = async ({ email, name, location, loginUrl }) => {
    try {
        const templatePath = path.join(__dirname, '../../templates/emails/password-reset-success.ejs');
        const html = await ejs.renderFile(templatePath, { 
            name, 
            email, 
            location, 
            loginUrl 
        });

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'TechyJaunt Academy'}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: '✅ Password Reset Successful',
            html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✉️ Password reset success email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Failed to send password reset success email:', error);
        throw error;
    }
};

module.exports = {
    sendWelcomeEmail,
    sendLoginNotification,
    sendPasswordResetEmail,
    sendPasswordResetSuccessEmail,
};
