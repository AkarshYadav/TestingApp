'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { createClass } from '@/actions/create-class';
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function CreateClass() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const router = useRouter();

    async function onSubmit(formData) {
        if (isLoading) return;
        
        setIsLoading(true);
        setError('');

        try {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

            const formDataObj = {
                get: (key) => formData.get(key)
            };

            // First attempt
            let result = await createClass(formDataObj);
            
            // If first attempt fails, try up to 2 more times
            let attempts = 1;
            while (!result.success && attempts < 3) {
                toast({
                    title: "Retrying",
                    description: `Attempt ${attempts + 1}/3...`,
                });
                
                // Wait for 1 second before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                result = await createClass(formDataObj);
                attempts++;
            }

            clearTimeout(timeoutId);

            if (result.success) {
                toast({
                    title: "Success",
                    description: "Class created successfully!",
                });
                router.push('/');
                router.refresh();
                return;
            }

            throw new Error(result.error || 'Failed to create class');

        } catch (error) {
            console.error('Error creating class:', error);
            
            const errorMessage = error.message === 'AbortError' 
                ? 'Request timed out. Please try again.'
                : error.message || "Failed to create class. Please try again.";

            setError(errorMessage);
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="max-w-md mx-auto mt-10 p-4">
            <h1 className="text-2xl font-bold mb-5">Create a New Class</h1>

            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <form action={onSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="className">Class Name *</Label>
                    <Input
                        id="className"
                        name="className"
                        required
                        minLength={3}
                        maxLength={50}
                        placeholder="Enter class name"
                        aria-required="true"
                        disabled={isLoading}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="section">Section</Label>
                    <Input
                        id="section"
                        name="section"
                        maxLength={20}
                        placeholder="Optional: Enter section"
                        disabled={isLoading}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                        id="subject"
                        name="subject"
                        maxLength={50}
                        placeholder="Optional: Enter subject"
                        disabled={isLoading}
                    />
                </div>

                <Button 
                    className="w-full"
                    variant="default" 
                    type="submit" 
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Creating...'}
                        </div>
                    ) : (
                        'Create Class'
                    )}
                </Button>
            </form>
        </div>
    );
}