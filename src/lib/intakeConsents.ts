export type IntakeLang = "en" | "es";
export const SMS_CONSENT_VERSION = "sms-v2-2026-11";
export const PHOTO_CONSENT_VERSION = "photo-v1-2026-11";

export const intakeLang = (code?: string | null): IntakeLang => (code === "es" ? "es" : "en");

export const INTAKE_TEXT = {
  en: {
    consentsTitle: "Consents",
    consentsHelp: "Please review and check each box to continue.",
    sms: "I agree to receive text messages from FRG about work notifications, assignments and clock-in (punch) links. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out.",
    photo: "I consent to FRG capturing and storing my photo for identification, site check-in verification and badges.",
    required: "Required",
    smsError: "Text message consent is required to apply.",
    photoError: "Photo consent is required to apply.",
    photoTitle: "Profile picture",
    photoLocked: "Check the photo consent box above before taking or uploading a photo.",
    takeSelfie: "Take selfie",
    upload: "Upload photo",
    retake: "Change photo",
    uploading: "Uploading…",
    photoRequired: "A profile photo is required.",
    photoHelp: "Face the camera, good light, no sunglasses. It will be cropped square.",
    gender: "Gender",
    male: "Male",
    female: "Female",
    genderError: "Please select one.",
  },
  es: {
    consentsTitle: "Consentimientos",
    consentsHelp: "Revise y marque cada casilla para continuar.",
    sms: "Acepto recibir mensajes de texto de FRG sobre notificaciones de trabajo, asignaciones y enlaces para marcar entrada/salida. La frecuencia varía. Pueden aplicarse tarifas de mensajes y datos. Responda STOP para cancelar.",
    photo: "Doy mi consentimiento para que FRG capture y guarde mi foto para identificación, verificación de entrada en el sitio y gafetes.",
    required: "Obligatorio",
    smsError: "El consentimiento de mensajes de texto es obligatorio.",
    photoError: "El consentimiento de foto es obligatorio.",
    photoTitle: "Foto de perfil",
    photoLocked: "Marque la casilla de consentimiento de foto antes de tomar o subir una foto.",
    takeSelfie: "Tomar selfie",
    upload: "Subir foto",
    retake: "Cambiar foto",
    uploading: "Subiendo…",
    photoRequired: "La foto de perfil es obligatoria.",
    photoHelp: "Mire a la cámara, con buena luz y sin lentes de sol. Se recortará en cuadrado.",
    gender: "Género",
    male: "Masculino",
    female: "Femenino",
    genderError: "Seleccione una opción.",
  },
} as const;

export type IntakeConsentState = { sms: boolean; photo: boolean };
