'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin, Check, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

const StudentView = ({ classId, classData, isActive, hasMarked, timeLeft, progressValue, onMarkAttendance }) => {
    const [enteredKey, setEnteredKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleKeyChange = (e) => {
        setEnteredKey(e.target.value);
        setError(''); // Clear error when user types
    };

    const handleAttendanceMark = async () => {
        if (!enteredKey.trim()) {
            setError('Please enter a key');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // First, fetch the latest key
            const keyResponse = await fetch(`/api/classes/${classId}/get-latest-key`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!keyResponse.ok) {
                throw new Error(`Failed to verify key: ${keyResponse.status}`);
            }

            const keyData = await keyResponse.json();

            if (!keyData.success) {
                throw new Error(keyData.message || 'Failed to verify key');
            }

            // Compare the keys
            if (enteredKey.trim() === keyData.latestKey.trim()) {
                // If keys match, mark attendance
                await onMarkAttendance();
                setEnteredKey('');
            } else {
                setError('Invalid or expired key. Please check with your teacher.');
            }
        } catch (err) {
            console.error('Attendance marking error:', err);
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {classData?.description && (
                <div>
                    <h3 className="text-lg font-semibold mb-2">About this class</h3>
                    <p className="text-muted-foreground">{classData.description}</p>
                </div>
            )}

            {isActive && (
                <Card className="bg-secondary">
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-primary" />
                                    <span className="font-medium">Attendance Session Active</span>
                                </div>
                                <span className="text-sm font-medium">{timeLeft} remaining</span>
                            </div>

                            <Progress value={progressValue} className="w-full" />

                            {!hasMarked ? (
                                <div className="w-full flex flex-col space-y-4">
                                    <div className="flex flex-col space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            Enter the unique key provided to you to mark your attendance.
                                        </p>
                                        <input
                                            type="text"
                                            value={enteredKey}
                                            onChange={handleKeyChange}
                                            placeholder="Enter your key"
                                            className="w-full p-2 border border-gray-300 rounded"
                                            disabled={loading}
                                        />
                                    </div>

                                    {error && (
                                        <Alert variant="destructive">
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    <Button
                                        onClick={handleAttendanceMark}
                                        className="w-full"
                                        disabled={!enteredKey.trim() || loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <MapPin className="h-4 w-4 mr-2" />
                                                Mark Attendance
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2 text-green-600">
                                    <Check className="h-5 w-5" />
                                    <span className="font-medium">Attendance Marked</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default StudentView;