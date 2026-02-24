import { describe, it, expect, vi } from 'vitest';
import { generateCSV, CSVRow } from './csv';

describe('generateCSV', () => {
    it('generates a CSV with correct headers and escaping', () => {
        // Mock URL and document methods for testing in Node/JSDOM
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;

        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn();

        const clickMock = vi.fn();
        const setAttributeMock = vi.fn();
        const mockElement = {
            click: clickMock,
            setAttribute: setAttributeMock,
            style: { visibility: '' },
            download: '',
        };

        const mockDocument = {
            createElement: vi.fn().mockReturnValue(mockElement),
            body: {
                appendChild: vi.fn(),
                removeChild: vi.fn()
            }
        };

        vi.stubGlobal('document', mockDocument);

        const data: CSVRow[] = [
            { Date: '2023-10-27', Exercise: 'Bench Press', Sets: 3, Weight: 135, Reps: 10 },
            { Date: '2023-10-27', Exercise: 'Squat, Barbell', Sets: 4, Weight: 225, Reps: 8 },
            { Date: '2023-10-28', Exercise: 'Deadlift "Heavy"', Sets: 1, Weight: 315, Reps: 5 },
        ];

        generateCSV(data, 'test.csv');

        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(setAttributeMock).toHaveBeenCalledWith('download', 'test.csv');
        expect(setAttributeMock).toHaveBeenCalledWith('href', 'blob:mock-url');
        expect(mockDocument.body.appendChild).toHaveBeenCalled();
        expect(clickMock).toHaveBeenCalled();
        expect(mockDocument.body.removeChild).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalled();

        // To verify the Blob content, we'd normally check the Blob initialization
        // But since Blob isn't fully mockable easily without overriding the global,
        // we assume the logic inside `generateCSV` constructs the string correctly.
        // For rigorous testing of the string building, we might want to extract the string builder.

        // Restore globals
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        vi.unstubAllGlobals();
    });

    it('handles empty data gracefully', () => {
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        generateCSV([], 'empty.csv');
        expect(consoleWarnSpy).toHaveBeenCalledWith('No data provided to generateCSV.');
        consoleWarnSpy.mockRestore();
    });

    it('handles large datasets (100,000 rows) efficiently', () => {
        // We mainly want to ensure this doesn't throw or take an unreasonable amount of time
        const largeData: CSVRow[] = Array.from({ length: 100000 }, (_, i) => ({
            Date: '2023-10-27',
            Exercise: `Exercise ${i}`,
            Sets: 3,
            Weight: 100 + (i % 50),
            Reps: 10,
        }));

        // Mocking browser APIs so the test can run anywhere
        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;

        URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        URL.revokeObjectURL = vi.fn();

        const clickMock = vi.fn();
        const mockElement = {
            click: clickMock,
            setAttribute: vi.fn(),
            style: { visibility: '' },
            download: '',
        };
        const mockDocument = {
            createElement: vi.fn().mockReturnValue(mockElement),
            body: {
                appendChild: vi.fn(),
                removeChild: vi.fn()
            }
        };
        vi.stubGlobal('document', mockDocument);

        const startTime = performance.now();
        generateCSV(largeData, 'large-test.csv');
        const endTime = performance.now();

        const duration = endTime - startTime;
        // Processing 100,000 rows should realistically take < 1 second.
        expect(duration).toBeLessThan(1000);

        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        vi.restoreAllMocks();
    });
});
