export interface CSVRow {
    Date: string;
    Exercise: string;
    Sets: number | string;
    Weight: number | string;
    Reps: number | string;
}

/**
 * Escapes a CSV field value.
 * Values containing commas, double quotes, or newlines must be enclosed in double quotes.
 * Double quotes inside the value are doubled.
 */
const escapeCSVField = (field: string | number): string => {
    const strField = String(field);
    if (/[",\n]/.test(strField)) {
        return `"${strField.replace(/"/g, '""')}"`;
    }
    return strField;
};

/**
 * Generates and triggers a download of a CSV file from an array of data rows.
 * @param data An array of objects matching the CSVRow interface.
 * @param filename The desired filename for the downloaded CSV file.
 */
export const generateCSV = (data: CSVRow[], filename: string = 'workout-data.csv'): void => {
    if (!data || data.length === 0) {
        console.warn('No data provided to generateCSV.');
        return;
    }

    const headers = ['Date', 'Exercise', 'Sets', 'Weight', 'Reps'];

    const csvContent = [
        headers.map(escapeCSVField).join(','),
        ...data.map((row) =>
            [row.Date, row.Exercise, row.Sets, row.Weight, row.Reps]
                .map(escapeCSVField)
                .join(',')
        ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Try to use a more robust download link approach
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        // Fallback for older browsers (though less common now)
        console.error('Browser does not support the download attribute.');
    }
};
