import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Cloud, 
  Loader2,
  ArrowLeft,
  Link2,
  Unlink,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  useExpenseCategoriesWithMapping,
  useAddExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
  useQuickBooksAccounts,
  useLinkCategoryToQuickBooks,
  useUnlinkCategoryFromQuickBooks,
  ExpenseCategoryType,
  ExpenseCategoryWithMapping,
} from "@/integrations/supabase/hooks/useExpenseCategories";

interface CategoryFormData {
  name: string;
  description: string;
  category_type: ExpenseCategoryType;
}

const defaultFormData: CategoryFormData = {
  name: "",
  description: "",
  category_type: "both",
};

const ExpenseCategories = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategoryWithMapping | null>(null);
  const [selectedQbAccountId, setSelectedQbAccountId] = useState<string>("");
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);

  const { data: categories, isLoading } = useExpenseCategoriesWithMapping();
  const { data: qbAccounts, isLoading: isLoadingQbAccounts } = useQuickBooksAccounts();
  const addCategory = useAddExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();
  const linkCategory = useLinkCategoryToQuickBooks();
  const unlinkCategory = useUnlinkCategoryFromQuickBooks();

  const filteredCategories = categories?.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cat.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesType = typeFilter === "all" || cat.category_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const handleAdd = () => {
    setFormData(defaultFormData);
    setIsAddDialogOpen(true);
  };

  const handleEdit = (category: any) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      category_type: category.category_type,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (category: ExpenseCategoryWithMapping) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const handleLink = (category: ExpenseCategoryWithMapping) => {
    setSelectedCategory(category);
    setSelectedQbAccountId("");
    setIsLinkDialogOpen(true);
  };

  const handleUnlink = (category: ExpenseCategoryWithMapping) => {
    setSelectedCategory(category);
    setIsUnlinkDialogOpen(true);
  };

  const handleLinkSubmit = async () => {
    if (!selectedCategory || !selectedQbAccountId) return;
    const qbAccount = qbAccounts?.find(a => a.id === selectedQbAccountId);
    if (!qbAccount) return;
    
    await linkCategory.mutateAsync({
      categoryId: selectedCategory.id,
      qbAccountId: qbAccount.id,
      qbAccountName: qbAccount.name,
      qbAccountType: qbAccount.type,
      qbAccountSubType: qbAccount.subType,
    });
    setIsLinkDialogOpen(false);
    setSelectedCategory(null);
    setSelectedQbAccountId("");
  };

  const handleUnlinkConfirm = async () => {
    if (!selectedCategory) return;
    await unlinkCategory.mutateAsync(selectedCategory.id);
    setIsUnlinkDialogOpen(false);
    setSelectedCategory(null);
  };

  const handleAddSubmit = async () => {
    await addCategory.mutateAsync({
      name: formData.name,
      description: formData.description || null,
      category_type: formData.category_type,
      is_active: true,
    });
    setIsAddDialogOpen(false);
    setFormData(defaultFormData);
  };

  const handleEditSubmit = async () => {
    if (!selectedCategory) return;
    await updateCategory.mutateAsync({
      id: selectedCategory.id,
      name: formData.name,
      description: formData.description || null,
      category_type: formData.category_type,
    });
    setIsEditDialogOpen(false);
    setSelectedCategory(null);
    setFormData(defaultFormData);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCategory) return;
    await deleteCategory.mutateAsync(selectedCategory.id);
    setIsDeleteDialogOpen(false);
    setSelectedCategory(null);
  };

  const getCategoryTypeBadge = (type: ExpenseCategoryType) => {
    switch (type) {
      case "vendor":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Vendor</Badge>;
      case "personnel":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Personnel</Badge>;
      case "both":
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Both</Badge>;
    }
  };

  return (
    <PageLayout
      title="Expense Categories"
      description="Manage expense categories for vendors and personnel"
    >
      <div className="mb-4">
        <Link to="/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Settings
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Categories</CardTitle>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="personnel">Personnel</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>QuickBooks</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No categories found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCategories?.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground max-w-[200px] truncate">
                          {category.description || "—"}
                        </TableCell>
                        <TableCell>{getCategoryTypeBadge(category.category_type)}</TableCell>
                        <TableCell>
                          {category.quickbooks_account_id ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                              <Cloud className="h-3 w-3 mr-1" />
                              Synced
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {category.quickbooks_account_id ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleUnlink(category)}
                                title="Unlink from QuickBooks"
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleLink(category)}
                                title="Link to QuickBooks"
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(category)}
                              disabled={!!category.quickbooks_account_id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense Category</DialogTitle>
            <DialogDescription>
              Create a new expense category for tracking expenses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Office Supplies"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Category Type</Label>
              <Select
                value={formData.category_type}
                onValueChange={(value: ExpenseCategoryType) => 
                  setFormData({ ...formData, category_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor">Vendor - For vendor expenses only</SelectItem>
                  <SelectItem value="personnel">Personnel - For personnel expenses only</SelectItem>
                  <SelectItem value="both">Both - For all expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddSubmit} 
              disabled={!formData.name || addCategory.isPending}
            >
              {addCategory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense Category</DialogTitle>
            <DialogDescription>
              Update the expense category details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-type">Category Type</Label>
              <Select
                value={formData.category_type}
                onValueChange={(value: ExpenseCategoryType) => 
                  setFormData({ ...formData, category_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="personnel">Personnel</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditSubmit} 
              disabled={!formData.name || updateCategory.isPending}
            >
              {updateCategory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"? This will hide the category from future use but preserve existing records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCategory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link to QuickBooks Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to QuickBooks Account</DialogTitle>
            <DialogDescription>
              Select a QuickBooks account to link with "{selectedCategory?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="qb-account">QuickBooks Account</Label>
            <Select value={selectedQbAccountId} onValueChange={setSelectedQbAccountId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select an account..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingQbAccounts ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  qbAccounts
                    ?.filter(acc => !acc.isMapped)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
            {qbAccounts && qbAccounts.filter(a => !a.isMapped).length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                All QuickBooks accounts are already linked.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleLinkSubmit} 
              disabled={!selectedQbAccountId || linkCategory.isPending}
            >
              {linkCategory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Link Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation */}
      <AlertDialog open={isUnlinkDialogOpen} onOpenChange={setIsUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink from QuickBooks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlink "{selectedCategory?.name}" from QuickBooks? The category will no longer sync with QuickBooks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlinkConfirm}
            >
              {unlinkCategory.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default ExpenseCategories;
