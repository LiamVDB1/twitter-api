export const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const seen = new WeakSet();

    const clean = (current: any): any => {
        if (!current || typeof current !== 'object') {
            return current;
        }

        if (seen.has(current)) {
            // If it's a tweet-like object, return its ID to break the cycle.
            if (current.id) {
                return { id: current.id };
            }
            // For other circular references, omit them.
            return undefined;
        }

        seen.add(current);

        if (Array.isArray(current)) {
            return current.map(item => clean(item));
        }

        const newObj: { [key: string]: any } = {};
        for (const key in current) {
            if (Object.prototype.hasOwnProperty.call(current, key)) {
                newObj[key] = clean(current[key]);
            }
        }

        return newObj;
    };

    return clean(obj);
}; 