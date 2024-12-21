"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [step, setStep] = useState('email');
    const [loading, setLoading] = useState(false);
    const [debugOTP, setDebugOTP] = useState(null);
    const router = useRouter();

    const sendOTP = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/auth/password-reset', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'send-otp',
                    email
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('OTP sent to your email');
                setStep('otp');
                // For development/testing purposes only
                if (data.debugOTP) {
                    setDebugOTP(data.debugOTP);
                    toast.info(`DebugOTP: ${data.debugOTP}`);
                }
            } else {
                toast.error(data.error || 'Failed to send OTP');
            }
        } catch (error) {
            toast.error('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const verifyOTP = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/auth/password-reset', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'verify-otp',
                    email,
                    otp
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                setStep('reset');
            } else {
                toast.error(data.error || 'OTP verification failed');
            }
        } catch (error) {
            toast.error('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/auth/password-reset', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'reset-password',
                    email,
                    otp,
                    newPassword
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Password reset successfully');
                router.push('/signin');
            } else {
                toast.error(data.error || 'Password reset failed');
            }
        } catch (error) {
            toast.error('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex justify-center items-center bg-gray-100">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Reset Password</CardTitle>
                    <CardDescription>
                        {step === 'email' && 'Enter your registered email'}
                        {step === 'otp' && 'Enter the OTP sent to your email'}
                        {step === 'reset' && 'Create a new password'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {step === 'email' && (
                        <>
                            <Input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mb-4"
                            />
                            <Button
                                onClick={sendOTP}
                                disabled={loading || !email}
                                className="w-full"
                            >
                                {loading ? 'Sending...' : 'Send OTP'}
                            </Button>
                        </>
                    )}

                    {step === 'otp' && (
                        <>
                            <Input
                                type="text"
                                placeholder="Enter 6-digit OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="mb-4"
                                maxLength={6}
                            />
                            {debugOTP && (
                                <p className="text-sm text-red-500 mb-4">
                                    Debug OTP: {debugOTP}
                                </p>
                            )}
                            <Button
                                onClick={verifyOTP}
                                disabled={loading || otp.length !== 6}
                                className="w-full"
                            >
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </Button>
                        </>
                    )}

                    {step === 'reset' && (
                        <>
                            <Input
                                type="password"
                                placeholder="New Password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mb-4"
                            />
                            <Button
                                onClick={resetPassword}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </Button>
                        </>
                    )}

                    <div className="text-center mt-4">
                        <Link href="/signin" className="text-blue-600 hover:underline text-sm">
                            Back to Sign In
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
