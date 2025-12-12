import { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

interface SidebarLayoutProps {
  children?: ReactNode;
}

/**
 * SidebarLayout wraps the application with a collapsible sidebar.
 * It provides the SidebarProvider context at a high level so sidebar state
 * persists across page navigation.
 * 
 * Use this as a layout route in React Router or wrap page content directly.
 */
export function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          {children ?? <Outlet />}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}