import { NextResponse } from 'next/server';
import connect from '@/lib/mongodb/mongoose';
import User from '@/lib/models/user.model';
import { generateOTP, sendOTPEmail } from '@/lib/passwordReset';
import bcrypt from 'bcrypt';

export async function POST(req) {
    try {
        await connect();
        const { action, email, otp, newPassword } = await req.json();

        switch (action) {
            case 'send-otp':
                const user = await User.findOne({ email });
                if (!user) {
                    return NextResponse.json({ error: 'User not found' }, { status: 404 });
                }

                const generatedOTP = generateOTP();

                // Store OTP and expiration time
                user.passwordResetToken = await bcrypt.hash(generatedOTP, 10);
                user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
                await user.save();

                // Send OTP via email
                await sendOTPEmail(email, generatedOTP);

                return NextResponse.json({ message: 'OTP sent successfully' }, { status: 200 });

            case 'verify-otp':
                const resetUser = await User.findOne({ email });
                if (!resetUser) {
                    return NextResponse.json({ error: 'User not found' }, { status: 404 });
                }

                // Check OTP expiration
                if (resetUser.passwordResetExpires < new Date()) {
                    return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
                }

                // Verify OTP
                const isOTPValid = await bcrypt.compare(otp, resetUser.passwordResetToken);
                if (!isOTPValid) {
                    return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
                }

                return NextResponse.json({ message: 'OTP verified successfully' }, { status: 200 });

            case 'reset-password':
                const passwordResetUser = await User.findOne({ email });
                if (!passwordResetUser) {
                    return NextResponse.json({ error: 'User not found' }, { status: 404 });
                }

                // Final verification before password reset
                const isFinalOTPValid = await bcrypt.compare(otp, passwordResetUser.passwordResetToken);
                if (!isFinalOTPValid) {
                    return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
                }

                // Reset password
                passwordResetUser.password = await bcrypt.hash(newPassword, 10);
                passwordResetUser.passwordResetToken = null;
                passwordResetUser.passwordResetExpires = null;
                await passwordResetUser.save();

                return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Password Reset Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
