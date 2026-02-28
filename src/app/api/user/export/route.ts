import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from "@/lib/auth-utils";
import { streamUserWorkoutData } from '@/lib/services/export.service';

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get('format') || 'csv';
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
        async start(controller) {
            try {
                const generator = streamUserWorkoutData(
                    supabase,
                    user.id,
                    50,
                    start || undefined,
                    end || undefined
                );
                let isFirstBatch = true;

                if (format === 'json') {
                    controller.enqueue(encoder.encode('[\n'));
                }

                for await (const batch of generator) {
                    if (batch.length === 0) continue;

                    if (format === 'csv') {
                        if (isFirstBatch) {
                            const headers = Object.keys(batch[0]).join(',');
                            controller.enqueue(encoder.encode(headers + '\n'));
                            isFirstBatch = false;
                        }

                        const csvRows = batch.map(row => {
                            return Object.values(row).map(val => {
                                if (val === null || val === undefined) return '';
                                const str = String(val);
                                if (str.includes(',') || str.includes('\n') || str.includes('\"')) {
                                    return `"${str.replace(/"/g, '""')}"`;
                                }
                                return str;
                            }).join(',');
                        }).join('\n');

                        controller.enqueue(encoder.encode(csvRows + '\n'));
                    } else if (format === 'json') {
                        const jsonBatch = batch.map(row => JSON.stringify(row)).join(',\n');
                        if (!isFirstBatch) {
                            controller.enqueue(encoder.encode(',\n' + jsonBatch));
                        } else {
                            controller.enqueue(encoder.encode(jsonBatch));
                            isFirstBatch = false;
                        }
                    }
                }

                if (format === 'json') {
                    controller.enqueue(encoder.encode('\n]'));
                }

                controller.close();
            } catch (error) {
                console.error('Export stream error:', error);
                controller.error(error);
            }
        }
    });

    const headers = new Headers();
    if (format === 'csv') {
        headers.set('Content-Type', 'text/csv');
        headers.set('Content-Disposition', 'attachment; filename="workout_history.csv"');
    } else {
        headers.set('Content-Type', 'application/json');
        headers.set('Content-Disposition', 'attachment; filename="workout_history.json"');
    }

    return new NextResponse(readableStream, { headers });
}
