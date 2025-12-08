export type Language = "en" | "es";

export const translations = {
  en: {
    // Portal page
    portalTitle: "Contractor Submission Portal",
    portalSubtitle: "Submit your bills and expense receipts",
    selectLanguage: "Select Your Language",
    selectLanguageSubtitle: "Seleccione Su Idioma",
    
    // Tabs
    submitBill: "Submit Bill",
    submitExpense: "Submit Expense",
    billSubmission: "Bill Submission",
    billDescription: "Submit invoices and bills for completed work",
    expenseSubmission: "Expense Submission",
    expenseDescription: "Submit receipts for project-related expenses",
    
    // Form field labels (mapped from field names)
    contractor_name: "Your Name",
    customer_name: "Customer",
    project_name: "Project Name",
    expense_description: "What was this for?",
    amount: "Receipt Amount",
    submission_date: "Date",
    files: "Upload Files",
    job_name: "Job / Project",
    
    // Placeholders
    enterYourName: "Enter your name",
    selectCustomer: "Search or add customer...",
    selectProject: "Select project",
    enterDescription: "Enter description",
    selectDate: "Select date",
    
    // Buttons
    submitting: "Submitting...",
    submitBillButton: "Submit Bill",
    submitExpenseButton: "Submit Expense",
    
    // Validation
    isRequired: "is required",
    
    // Footer
    needHelp: "Need help? Contact your project manager.",
    
    // Combobox / Customer input
    noCustomerFound: "No customer found.",
    addNew: "Add",
    typeToSearch: "Type to search...",
    typeCustomerName: "Type customer name...",
    other: "Other",
    
    // Success messages
    submissionSuccess: "Submission successful!",
    submissionError: "Failed to submit. Please try again.",

    // Loading
    loading: "Loading...",
    formNotFound: "Form configuration not found.",
  },
  es: {
    // Portal page
    portalTitle: "Portal de Envío de Contratistas",
    portalSubtitle: "Envíe sus facturas y recibos de gastos",
    selectLanguage: "Select Your Language",
    selectLanguageSubtitle: "Seleccione Su Idioma",
    
    // Tabs
    submitBill: "Enviar Factura",
    submitExpense: "Enviar Gasto",
    billSubmission: "Envío de Factura",
    billDescription: "Envíe facturas por trabajo completado",
    expenseSubmission: "Envío de Gasto",
    expenseDescription: "Envíe recibos de gastos relacionados con proyectos",
    
    // Form field labels (mapped from field names)
    contractor_name: "Su Nombre",
    customer_name: "Cliente",
    project_name: "Nombre del Proyecto",
    expense_description: "¿Para qué fue esto?",
    amount: "Monto del Recibo",
    submission_date: "Fecha",
    files: "Subir Archivos",
    job_name: "Trabajo / Proyecto",
    
    // Placeholders
    enterYourName: "Ingrese su nombre",
    selectCustomer: "Buscar o agregar cliente...",
    selectProject: "Seleccione proyecto",
    enterDescription: "Ingrese descripción",
    selectDate: "Seleccione fecha",
    
    // Buttons
    submitting: "Enviando...",
    submitBillButton: "Enviar Factura",
    submitExpenseButton: "Enviar Gasto",
    
    // Validation
    isRequired: "es requerido",
    
    // Footer
    needHelp: "¿Necesita ayuda? Contacte a su gerente de proyecto.",
    
    // Combobox / Customer input
    noCustomerFound: "No se encontró cliente.",
    addNew: "Agregar",
    typeToSearch: "Escriba para buscar...",
    typeCustomerName: "Escriba el nombre del cliente...",
    other: "Otro",
    
    // Success messages
    submissionSuccess: "¡Envío exitoso!",
    submissionError: "Error al enviar. Por favor intente de nuevo.",

    // Loading
    loading: "Cargando...",
    formNotFound: "Configuración de formulario no encontrada.",
  }
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getTranslation(language: Language, key: TranslationKey): string {
  return translations[language][key] || translations.en[key] || key;
}

export function getFieldLabel(language: Language, fieldName: string, fallbackLabel: string): string {
  const key = fieldName as TranslationKey;
  if (translations[language][key]) {
    return translations[language][key];
  }
  return fallbackLabel;
}
