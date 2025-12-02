-- Insert default company settings with 8.25% tax rate
INSERT INTO company_settings (company_name, default_tax_rate)
SELECT 'My Company', 8.25
WHERE NOT EXISTS (SELECT 1 FROM company_settings LIMIT 1);