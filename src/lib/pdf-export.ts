import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function generatePDF(elementId: string, filename: string): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
        throw new Error(`Element with id ${elementId} not found.`);
    }

    // Temporarily make the element visible with proper dimensions for html2canvas
    const originalDisplay = element.style.display;
    const originalPosition = element.style.position;
    const originalLeft = element.style.left;
    const originalTop = element.style.top;
    const originalWidth = element.style.width;
    const originalHeight = element.style.height;

    // Set the element up for capture
    element.style.display = "block";
    element.style.position = "absolute";
    element.style.left = "0";
    element.style.top = "0";
    element.style.width = "794px"; // A4 width at 96 DPI
    // element.style.height = "1123px"; // A4 height, let it be auto for content if it's longer

    // Force a small delay to ensure all recharts are fully rendered without animations
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        const canvas = await html2canvas(element, {
            scale: 2, // Higher resolution
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff", // Force white background for PDF
            windowWidth: 794,
        });

        const imgData = canvas.toDataURL("image/jpeg", 1.0);

        // Calculate PDF dimensions (A4)
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        // Add image, check if it needs multiple pages
        let heightLeft = pdfHeight;
        let position = 0;
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
        }

        pdf.save(filename);
    } finally {
        // Restore original styles
        element.style.display = originalDisplay;
        element.style.position = originalPosition;
        element.style.left = originalLeft;
        element.style.top = originalTop;
        element.style.width = originalWidth;
        element.style.height = originalHeight;
    }
}
