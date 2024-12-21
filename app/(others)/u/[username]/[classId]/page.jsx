'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { useAttendance } from '@/store/useAttendance';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Copy, Check, MapPin, Clock, Users, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import AttendanceHistory from '@/components/classes/AttendanceHistory';
import StudentAnalytics from '@/components/classes/StudentAnalytics';
import LiveAttendanceList from '@/components/classes/LiveAttendanceList';
import StudentAttendanceHistory from '@/components/classes/StudentAttendanceHistory';
import StudentPersonalAnalytics from '@/components/classes/StudentPersonalAnalytics';
import TeacherView from './TeacherView';
import StudentView from './StudentView';

const ClassPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [copied, setCopied] = useState(false);
  const [totalDuration, setTotalDuration] = useState(null);
  const [selectedTab, setSelectedTab] = useState('attendance');

  const {
    isActive,
    sessionId,
    hasMarked,
    endTime,
    loading: attendanceLoading,
    error: attendanceError,
    startAttendance,
    markAttendance,
    endAttendance,
    extendAttendance,
    refreshStatus
  } = useAttendance(params?.classId);

  const [timeLeft, setTimeLeft] = useState(null);
  const [progressValue, setProgressValue] = useState(100);

  // Fetch class data
  useEffect(() => {
    const fetchClassData = async () => {
      try {
        if (!params?.classId) throw new Error('Class ID is missing');
        const response = await axios.get(`/api/classes/${params.classId}`);
        setClassData(response.data.classData);
        setUserRole(response.data.userRole);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to fetch class data');
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') fetchClassData();
  }, [params?.classId, status]);

  // Authentication check
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/signin');
  }, [status, router]);

  // Timer logic with dynamic duration
  useEffect(() => {
    let intervalId;

    if (isActive && endTime) {
      const end = new Date(endTime).getTime();

      // Calculate total duration when session starts
      if (!totalDuration) {
        const start = Date.now();
        setTotalDuration(end - start);
      }

      intervalId = setInterval(() => {
        const now = Date.now();
        const remaining = end - now;

        if (remaining <= 0) {
          setTimeLeft(null);
          setProgressValue(0);
          clearInterval(intervalId);
          refreshStatus();
        } else {
          const minutes = Math.floor(remaining / 60000);
          const seconds = Math.floor((remaining % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);

          // Calculate progress based on remaining time and total duration
          const progress = (remaining / totalDuration) * 100;
          setProgressValue(Math.max(0, progress));
        }
      }, 1000);
    }

    return () => clearInterval(intervalId);
  }, [isActive, endTime, refreshStatus, totalDuration]);

  // Location handling
  const handleLocationAction = async (action, options = null) => {
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by your browser');
      }

      if (action === 'end') {
        await endAttendance();
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        });
      });

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      if (action === 'start') {
        const { duration, radius } = options || {};

        // Validate the presence of both duration and radius
        if (!duration || !radius) {
          throw new Error('Both duration and radius must be provided for starting attendance');
        }

        await startAttendance({
          location,
          duration, // Pass duration in seconds
          radius,   // Pass radius in meters
        });

        setTotalDuration(duration * 1000); // Convert seconds to milliseconds
      } else if (action === 'mark') {
        await markAttendance(location);
      }
    } catch (err) {
      if (err.name === 'GeolocationPositionError') {
        setError('Please enable location access to use attendance features');
      } else {
        setError(err.message || 'Failed to process attendance action');
      }
    }
  };

  const handleCopyClassCode = () => {
    navigator.clipboard.writeText(classData?.classCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (loading || attendanceLoading) {
    return (
      <div className="fixed inset-0 flex justify-center items-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
    
    );
  }

  // Error state
  if (error || attendanceError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || attendanceError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">
              {classData?.className}
            </CardTitle>
            {isActive && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Live Session
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {classData?.subject} {classData?.section && `- ${classData.section}`}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2 mb-6">
            <Button
              variant={selectedTab === 'attendance' ? 'default' : 'outline'}
              onClick={() => setSelectedTab('attendance')}
            >
              Attendance
            </Button>
            <Button
              variant={selectedTab === 'history' ? 'default' : 'outline'}
              onClick={() => setSelectedTab('history')}
            >
              History
            </Button>
            <Button
              variant={selectedTab === 'analytics' ? 'default' : 'outline'}
              onClick={() => setSelectedTab('analytics')}
            >
              Analytics
            </Button>

          </div>

          {selectedTab === 'attendance' && (
            userRole === 'teacher' ? (
              <TeacherView
                classId={params.classId}
                classData={classData}
                isActive={isActive}
                sessionId={sessionId}
                timeLeft={timeLeft}
                progressValue={progressValue}
                copied={copied}
                onCopyCode={handleCopyClassCode}
                onStartAttendance={(options) => handleLocationAction('start', options)}
                onEndAttendance={() => handleLocationAction('end')}
                onExtendAttendance={(options) => {
                  const { duration } = options;
                  extendAttendance({ duration });
                }}
              />
            ) : (
              <StudentView
                classId={params.classId}
                classData={classData}
                isActive={isActive}
                hasMarked={hasMarked}
                timeLeft={timeLeft}
                progressValue={progressValue}
                onMarkAttendance={() => handleLocationAction('mark')}
              />
            )
          )}

          {selectedTab === 'history' && (
            userRole === 'teacher' ? (
              <AttendanceHistory classId={params.classId} userRole={userRole} />
            ) : (
              <StudentAttendanceHistory classId={params.classId} />
            )
          )}

          {selectedTab === 'analytics' && (
            userRole === 'teacher' ? (
              <StudentAnalytics classId={params.classId} userRole={userRole} />
            ) : (
              <StudentPersonalAnalytics classId={params.classId} />
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
};


export default ClassPage;