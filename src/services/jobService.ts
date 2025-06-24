import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

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

const logJobs = (message: string) => {
    // Correctly logs the contents of the Map for debugging.
    const jobsToLog = Object.fromEntries(
        Array.from(jobs.values()).map(job => [job.id, {
            id: job.id,
            status: job.status,
            createdAt: job.createdAt,
        }])
    );
    logger.debug(`${message} | Current jobs: ${JSON.stringify(jobsToLog)}`);
}

const createJob = <T>(payload: any): Job<T> => {
    const newJob: Job<T> = {
        id: uuidv4(),
        status: 'pending',
        payload,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    jobs.set(newJob.id, newJob);
    logJobs(`Created job ${newJob.id}`);
    return newJob;
};

const getJob = <T>(id: string): Job<T> | undefined => {
    logJobs(`Attempting to get job ${id}`);
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
        logJobs(`Updated job ${id} to status ${status}`);
        return job;
    }
    return undefined;
};

export const jobService = {
    createJob,
    getJob,
    updateJobStatus,
}; 