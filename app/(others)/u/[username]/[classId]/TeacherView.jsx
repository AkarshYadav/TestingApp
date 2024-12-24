'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Check, MapPin, Clock, Users, RotateCcw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import LiveAttendanceList from '@/components/classes/LiveAttendanceList';


const TeacherView = ({
    classId,
    classData,
    isActive,
    sessionId,
    timeLeft,
    progressValue,
    copied,
    onCopyCode,
    onStartAttendance,
    onEndAttendance,
    onExtendAttendance
}) => {
    const [showDurationModal, setShowDurationModal] = useState(false);
    const [duration, setDuration] = useState(5); // Default 5 minutes
    const [radius, setRadius] = useState(100);
    const [uniqueKey, setUniqueKey] = useState('');
    const [qrCodeValue, setQrCodeValue] = useState(uniqueKey);
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendDuration, setExtendDuration] = useState(5);
    const [sessionExpired, setSessionExpired] = useState(false);

    // Generate a secure unique key
    const generateUniqueKey = () => {
        return `key_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Save the key to the database
    const saveKeyToDatabase = async (classId, key) => {
        try {
            const response = await fetch(`/api/classes/${classId}/update-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId, newKey: key }), // Use `newKey` as per your API structure
            });

            if (!response.ok) {
                console.error('Failed to save key:', await response.json());
            }
        } catch (error) {
            console.error('Error saving key:', error);
        }
    };

    // Handle key generation and database sync
    useEffect(() => {
        const updateKey = async () => {
            const newKey = generateUniqueKey();
            setUniqueKey(newKey);

            // Save the new key 
            await saveKeyToDatabase(classId, newKey);
        };

        if (isActive) {
            updateKey();
            const intervalId = setInterval(updateKey, 30000);
            return () => clearInterval(intervalId);
        }
    }, [isActive, classId]);

    // Track session expiration
    useEffect(() => {
        if (progressValue === 0 && isActive) {
            setSessionExpired(true);
        }
    }, [progressValue, isActive]);

    const handleStartAttendance = () => {
        setShowDurationModal(true);
        setSessionExpired(false);
    };

    const handleConfirmStart = () => {
        setQrCodeValue(uniqueKey);

        onStartAttendance({
            duration: duration * 60,
            radius,
        });
        setShowDurationModal(false);
        setSessionExpired(false);
    };

    const handleExtendSession = () => {
        onExtendAttendance({
            duration: extendDuration * 60 // Convert minutes to seconds
        });
        setShowExtendModal(false);
        setSessionExpired(false);
    };

    useEffect(() => {
        // QR code is updated when uniqueKey changes
        if (isActive) {
            setQrCodeValue(uniqueKey);
        }
    }, [isActive, uniqueKey]);

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-4">
                <p className="text-sm font-medium">Class Code: {classData?.classCode}</p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopyCode}
                    className="flex items-center gap-2"
                >
                    {copied ? (
                        <>
                            <Check className="h-4 w-4" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="h-4 w-4" />
                            Copy Code
                        </>
                    )}
                </Button>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    {!isActive ? (
                        <Button
                            onClick={handleStartAttendance}
                            className="w-full sm:w-auto"
                        >
                            <MapPin className="h-4 w-4 mr-2" />
                            Start Attendance
                        </Button>
                    ) : (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                variant={sessionExpired ? 'secondary' : "default"}
                                className="flex-1"
                                disabled={true}
                            >
                                <Clock className="h-4 w-4 mr-2" />
                                {sessionExpired ? 'Session Expired' : 'Session Active'}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={onEndAttendance}
                                className="flex-1"
                            >
                                End Session
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowExtendModal(true)}
                                className="flex-1"
                            >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Extend
                            </Button>
                        </div>
                    )}
                    {(timeLeft || sessionExpired) && (
                        <span className="text-sm font-medium">
                            Time Remaining: {timeLeft || '0:00'}
                        </span>
                    )}
                </div>

                {isActive && !sessionExpired && qrCodeValue && (
                    <div className="my-4 flex flex-col justify-center items-center">
                        <p className="mt-4">
                            Scan this QR code to mark your attendance.
                        </p>
                        <QRCodeCanvas
                            value={qrCodeValue}
                            size={256}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="H"
                            includeMargin={true}
                        />
                    </div>
                )}

                {isActive && (
                    <LiveAttendanceList classId={classId} />
                )}

                {isActive && (
                    <div className="space-y-2">
                        <Progress value={progressValue} className="w-full" />
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Session Progress</span>
                            <span>{Math.round(progressValue)}% remaining</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Duration Modal for Starting Attendance */}
            {showDurationModal && (
                <Dialog open={showDurationModal} onOpenChange={setShowDurationModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Set Attendance Duration</DialogTitle>
                            <DialogDescription>
                                Choose how long the attendance session should last
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <Label htmlFor="duration">Duration (minutes)</Label>
                                <Input
                                    id="duration"
                                    type="number"
                                    value={duration}
                                    onChange={(e) => setDuration(Number(e.target.value))}
                                    min={1}
                                    max={60}
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <Label htmlFor="radius">Attendance Radius (meters)</Label>
                                <Input
                                    id="radius"
                                    type="number"
                                    value={radius}
                                    onChange={(e) => setRadius(Number(e.target.value))}
                                    min={10}
                                    max={500}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDurationModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmStart}>Start Session</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Extend Session Modal */}
            {showExtendModal && (
                <Dialog open={showExtendModal} onOpenChange={setShowExtendModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Extend Attendance Session</DialogTitle>
                            <DialogDescription>
                                Choose additional duration for the attendance session
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <Label htmlFor="extendDuration">Additional Duration (minutes)</Label>
                                <Input
                                    id="extendDuration"
                                    type="number"
                                    value={extendDuration}
                                    onChange={(e) => setExtendDuration(Number(e.target.value))}
                                    min={1}
                                    max={60}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowExtendModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleExtendSession}>Extend Session</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {classData?.description && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">About this class</h3>
                    <p className="text-muted-foreground">{classData.description}</p>
                </div>
            )}
        </div>
    );
};

export default TeacherView;