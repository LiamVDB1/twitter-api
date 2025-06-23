import { v4 as uuidv4 } from 'uuid';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job<T> {
    id: string;
    status: JobStatus;
    payload: any;
    result?: T;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

// In-memory store for jobs
const jobs = new Map<string, Job<any>>();

const createJob = <T>(payload: any): Job<T> => {
    const newJob: Job<T> = {
        id: uuidv4(),
        status: 'pending',
        payload,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    jobs.set(newJob.id, newJob);
    return newJob;
};

const getJob = <T>(id: string): Job<T> | undefined => {
    return jobs.get(id);
};

const updateJobStatus = <T>(id: string, status: JobStatus, result?: T, error?: string): Job<T> | undefined => {
    const job = jobs.get(id);
    if (job) {
        job.status = status;
        job.updatedAt = new Date();
        if (result) {
            job.result = result;
        }
        if (error) {
            job.error = error;
        }
        jobs.set(id, job);
        return job;
    }
    return undefined;
};

export const jobService = {
    createJob,
    getJob,
    updateJobStatus,
}; 