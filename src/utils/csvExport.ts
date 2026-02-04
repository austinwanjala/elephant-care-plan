
export function exportToCsv(filename: string, data: any[]) {
    if (!data || data.length === 0) {
        console.warn("No data to export");
        return;
    }

    // Get headers from the first object
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
        headers.join(","), // Header row
        ...data.map(row =>
            headers.map(fieldName => {
                const value = row[fieldName];
                // Handle strings with commas, quotes, or newlines
                if (typeof value === "string") {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                // Handle objects/arrays (stringify them)
                if (typeof value === "object" && value !== null) {
                    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                }
                return value;
            }).join(",")
        )
    ].join("\n");

    // Create a Blob
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    // Create download link
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
