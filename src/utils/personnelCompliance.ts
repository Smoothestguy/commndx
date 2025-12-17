// Partial personnel type for compliance checking - only needs compliance-related fields
export interface PersonnelComplianceData {
  everify_status?: string | null;
  everify_expiry?: string | null;
  work_auth_expiry?: string | null;
  i9_completed_at?: string | null;
  certifications?: Array<{
    id: string;
    certification_name: string;
    expiry_date?: string | null;
  }> | null;
}

export interface ComplianceResult {
  isOutOfCompliance: boolean;
  issues: string[];
  severity: 'ok' | 'warning' | 'critical';
}

export function checkPersonnelCompliance(personnel: PersonnelComplianceData | null | undefined): ComplianceResult {
  if (!personnel) {
    return { isOutOfCompliance: false, issues: [], severity: 'ok' };
  }

  const issues: string[] = [];
  let hasCritical = false;
  let hasWarning = false;
  const today = new Date();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // E-Verify status issues
  if (personnel.everify_status === 'rejected') {
    issues.push('E-Verify rejected');
    hasCritical = true;
  } else if (personnel.everify_status === 'expired') {
    issues.push('E-Verify expired');
    hasCritical = true;
  }

  // E-Verify expiry
  if (personnel.everify_expiry) {
    const expiryDate = new Date(personnel.everify_expiry);
    if (expiryDate < today) {
      issues.push('E-Verify has expired');
      hasCritical = true;
    } else if (expiryDate < thirtyDaysFromNow) {
      issues.push('E-Verify expiring soon');
      hasWarning = true;
    }
  }

  // Work authorization expiry
  if (personnel.work_auth_expiry) {
    const expiryDate = new Date(personnel.work_auth_expiry);
    if (expiryDate < today) {
      issues.push('Work authorization expired');
      hasCritical = true;
    } else if (expiryDate < thirtyDaysFromNow) {
      issues.push('Work authorization expiring soon');
      hasWarning = true;
    }
  }

  // I-9 not completed
  if (!personnel.i9_completed_at) {
    issues.push('I-9 not completed');
    hasWarning = true;
  }

  // Expired certifications
  if (personnel.certifications?.length) {
    const expiredCerts = personnel.certifications.filter(
      cert => cert.expiry_date && new Date(cert.expiry_date) < today
    );
    const expiringCerts = personnel.certifications.filter(
      cert => cert.expiry_date && new Date(cert.expiry_date) >= today && new Date(cert.expiry_date) < thirtyDaysFromNow
    );
    
    if (expiredCerts.length > 0) {
      issues.push(`${expiredCerts.length} expired certification(s)`);
      hasCritical = true;
    }
    if (expiringCerts.length > 0) {
      issues.push(`${expiringCerts.length} certification(s) expiring soon`);
      hasWarning = true;
    }
  }

  return {
    isOutOfCompliance: issues.length > 0,
    issues,
    severity: hasCritical ? 'critical' : hasWarning ? 'warning' : 'ok',
  };
}
