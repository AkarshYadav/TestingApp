'use server';

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import Class from '@/lib/models/class.model';
import User from '@/lib/models/user.model';
import connect from '@/lib/mongodb/mongoose';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcrypt';

export async function createClass(formData) {
    try {
        // Connect to database first
        await connect();

        // Get session early
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: 'Unauthorized' };
        }

        // Validate input early
        const className = formData.get('className');
        const section = formData.get('section');
        const subject = formData.get('subject');

        if (!className?.trim()) {
            return { success: false, error: 'Class name is required' };
        }

        // Find existing user
        const user = await User.findOne({
            email: { $regex: new RegExp(`^${session.user.email}$`, 'i') }
        });

        // Create user if not found
        let finalUser = user;
        if (!user && session.user.email) {
            const collegeId = session.user.email.split('@')[0];
            finalUser = await User.create({
                email: session.user.email,
                password: await bcrypt.hash(Math.random().toString(36), 10),
                collegeId,
                createdClasses: [],
                enrolledIn: []
            });
        }

        if (!finalUser) {
            return { success: false, error: 'User not found and cannot be created' };
        }

        // Generate class code
        const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Create the class
        const newClass = await Class.create({
            className: className.trim(),
            section: section?.trim() || '',
            subject: subject?.trim() || '',
            classCode,
            creator: finalUser._id,
            description: '',
            materials: [],
            enrollments: []
        });

        // Update user's createdClasses
        await User.findByIdAndUpdate(finalUser._id, {
            $push: { createdClasses: newClass._id }
        });

        revalidatePath('/');
        return { 
            success: true, 
            data: {
                _id: newClass._id,
                className: newClass.className,
                classCode: newClass.classCode
            }
        };

    } catch (error) {
        console.error('Error creating class:', error);
        return { 
            success: false, 
            error: error.message || 'Failed to create class'
        };
    }
}