// ── Workout CSV ───────────────────────────────────────────────────────────────

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
 * Prefixes formula injection trigger characters with a single quote to prevent
 * CSV formula injection attacks in Excel and Google Sheets.
 */
export function escapeCSVField(value: unknown): string {
  const str = value == null ? "" : String(value);
  // Prevent CSV formula injection (Excel, Google Sheets)
  // Prefix with single quote to defuse any formula trigger characters
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (safe.includes(",") || safe.includes("\n") || safe.includes('"')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

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

// ── Nutrition CSV ─────────────────────────────────────────────────────────────

export interface NutritionCSVRow {
  Date: string;
  Meal: string;
  Food: string;
  Calories: number | string;
  Protein_g: number | string;
  Carbs_g: number | string;
  Fat_g: number | string;
  Servings: number | string;
}

/**
 * Generates and triggers a download of a CSV file from nutrition log data.
 */
export function generateNutritionCSV(
  data: NutritionCSVRow[],
  filename: string = "nutrition-history.csv"
): void {
  if (!data || data.length === 0) {
    console.warn("No data provided to generateNutritionCSV.");
    return;
  }

  const headers = ["Date", "Meal", "Food", "Calories", "Protein_g", "Carbs_g", "Fat_g", "Servings"];

  const csvContent = [
    headers.map(escapeCSVField).join(","),
    ...data.map((row) =>
      [
        row.Date,
        row.Meal,
        row.Food,
        row.Calories,
        row.Protein_g,
        row.Carbs_g,
        row.Fat_g,
        row.Servings,
      ]
        .map(escapeCSVField)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// ── Body Metrics CSV ──────────────────────────────────────────────────────────

export interface BodyMetricsCSVRow {
  Date: string;
  Weight_kg: number | string;
  Weight_lbs: number | string;
  Body_Fat_Pct: number | string;
  Note: string;
}

/**
 * Generates and triggers a download of a CSV file from body weight log data.
 */
export function generateBodyMetricsCSV(
  data: BodyMetricsCSVRow[],
  filename: string = "body-metrics.csv"
): void {
  if (!data || data.length === 0) {
    console.warn("No data provided to generateBodyMetricsCSV.");
    return;
  }

  const headers = ["Date", "Weight_kg", "Weight_lbs", "Body_Fat_Pct", "Note"];

  const csvContent = [
    headers.map(escapeCSVField).join(","),
    ...data.map((row) =>
      [row.Date, row.Weight_kg, row.Weight_lbs, row.Body_Fat_Pct, row.Note]
        .map(escapeCSVField)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
