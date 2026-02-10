
import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            worker_id,
            metric_name,
            min_value,
            mean_value,
            recommended_threshold,
            generations_run
        } = body;

        if (!metric_name) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const sql = `
      INSERT INTO calibration_logs (
        worker_id, metric_name, min_value, mean_value, 
        recommended_threshold, generations_run
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

        const workerIdVal = worker_id || null;

        const result = await query(sql, [
            workerIdVal, metric_name, min_value, mean_value,
            recommended_threshold, generations_run
        ]);

        return NextResponse.json({
            success: true,
            id: result.rows[0].id
        });

    } catch (error) {
        console.error('Error logging calibration:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const sql = `
            SELECT 
                cl.*, 
                w.worker_name
            FROM calibration_logs cl
            LEFT JOIN workers w ON cl.worker_id = w.id
            ORDER BY cl.executed_at DESC
            LIMIT 100
        `;
        const result = await query(sql);
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Error fetching calibration logs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
