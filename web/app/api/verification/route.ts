
import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { worker_id, test_suite, status, details } = body;

        if (!test_suite || !status) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Insert verification log
        const sql = `
      INSERT INTO system_verification (worker_id, test_suite, status, details)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;

        // Handle worker_id being optional/or lookup
        // For now assuming UUID is passed, or NULL if not provided
        const workerIdVal = worker_id || null;

        const result = await query(sql, [workerIdVal, test_suite, status, details]);

        return NextResponse.json({
            success: true,
            id: result.rows[0].id
        });

    } catch (error) {
        console.error('Error logging verification:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const sql = `
            SELECT * FROM system_verification
            ORDER BY executed_at DESC
            LIMIT 50
        `;
        const result = await query(sql);
        return NextResponse.json(result.rows);
    } catch (error) {
        console.error('Error fetching verification logs:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
