'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, MapPin, Check } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const StudentView = ({ classId, classData, isActive, hasMarked, timeLeft, progressValue, onMarkAttendance }) => {
    const [enteredKey, setEnteredKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleKeyChange = (e) => setEnteredKey(e.target.value);

    const handleAttendanceMark = async () => {
        setLoading(true);
        setError('');
        console.log(`classId: ${classId}`);
    
        try {
            // Ensure classId is correctly included in the query parameters
            const response = await fetch(`/api/classes/${classId}/get-latest-key?classId=${classId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
    
            const data = await response.json();
    
            // Check if the response is not OK
            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch the key.');
            }
    
            // Extract the latest key from the response
            const { latestKey } = data;
    
            console.log('Fetched Latest Key:', latestKey); // Log fetched key for debugging
            console.log('Entered Key:', enteredKey); // Log entered key for debugging
    
            // Compare the entered key with the fetched latest key
            if (enteredKey.trim() === latestKey.trim()) {
                console.log('Keys Match! Attendance Marked');
                onMarkAttendance();
                setError('');
            } else {
                console.log('Keys Do Not Match:', { enteredKey, latestKey });
                setError('Invalid or expired key. Please check with your teacher.');
            }
        } catch (err) {
            console.error('Error verifying key:', err);
            setError('Something went wrong. Please try again.');
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
                                <div className="w-full flex flex-col">
                                    <div className="flex my-5">
                                        <p className="text-sm text-muted-foreground w-2/3 flex items-center">
                                            Enter the unique key provided to you to mark your attendance.
                                        </p>
                                        <input
                                            type="text"
                                            value={enteredKey}
                                            onChange={handleKeyChange}
                                            placeholder="Enter your key"
                                            className="w-1/3 p-2 border border-gray-300 rounded"
                                        />
                                    </div>

                                    {error && (
                                        <div className="text-red-500 mb-4">
                                            <p>{error}</p>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleAttendanceMark}
                                        className="w-full"
                                        disabled={!enteredKey}
                                    >
                                        <MapPin className="h-4 w-4 mr-2" />
                                        Mark Attendance
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
