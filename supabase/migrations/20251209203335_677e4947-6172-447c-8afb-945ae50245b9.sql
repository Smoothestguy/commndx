-- Add jobsite_address column to customers table
ALTER TABLE public.customers 
ADD COLUMN jobsite_address text;