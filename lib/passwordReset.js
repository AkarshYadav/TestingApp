import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Generate 6-digit OTP
export const generateOTP = () => {
    return crypto.randomInt(100000, 999999).toString();
};

// Send OTP via email
export const sendOTPEmail = async (email, otp) => {
    // Configure your email transporter (using Gmail as an example)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset OTP - AttendEase',
        text: `Your OTP for password reset is: ${otp}. This OTP will expire in 10 minutes.`
    };

    await transporter.sendMail(mailOptions);
};
