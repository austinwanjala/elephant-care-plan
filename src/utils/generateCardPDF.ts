import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * Generates a printable PDF for a member's insurance card
 * @param elementId The HTML ID of the card element to capture
 * @param memberName The name of the member for the filename
 */
export const generateCardPDF = async (elementId: string, memberName: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error("Element not found for PDF generation");
        return;
    }

    try {
        const canvas = await html2canvas(element, {
            scale: 3, // High quality
            useCORS: true,
            backgroundColor: null,
        });

        const imgData = canvas.toDataURL("image/png");

        // Create PDF (Credit card size: 85.6mm x 53.98mm)
        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: [85.6, 54]
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Center horizontally and vertically
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

        // Save the PDF
        pdf.save(`Insurance_Card_${memberName.replace(/\s+/g, '_')}.pdf`);

        return true;
    } catch (error) {
        console.error("Error generating PDF:", error);
        throw error;
    }
};
