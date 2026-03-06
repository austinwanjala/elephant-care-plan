/**
 * DigitalPersona Global Bridge
 * 
 * This file provides a centralized way to access the DigitalPersona SDKs
 * which are loaded via script tags in index.html to avoid Vite bundling issues.
 */

// Accessing globals from window.dp (Core and Devices)
const dp = (typeof window !== 'undefined' ? (window as any).dp : {}) || {};

// Re-exporting common types and classes from the global dp object
export const {
    FingerprintReader,
    SampleFormat,
    DeviceConnected,
    DeviceDisconnected,
    SamplesAcquired,
    CommunicationFailed,
    ErrorOccurred,
    QualityReported,
    DeviceUidType,
    DeviceModality,
    DeviceTechnology,
    QualityCode
} = dp.devices || {};

export const {
    Base64Url,
    Utf8,
    Utf16,
    Base64
} = dp.core || {};

// If the global dp object isn't found, these will be undefined, 
// which the app already handles via its null checks and error messages.
