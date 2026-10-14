'use client'

import { Coffee } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { permissions } from '@/config/permissions'
import { CategoriesTab } from '../components/CategoriesTab'
import { MenuItemsTab } from '../components/MenuItemsTab'
import { ToppingsTab } from '../components/ToppingsTab'

/** SCR-09 Thực đơn (UC-01, UC-02): tab Món, Danh mục, Topping. */
export function MenuItemsPage() {
  return (
    <PermissionGuard permission={permissions.menuItems.view} redirect>
      <div className="space-y-6">
        <PageHeader
          title="Thực đơn"
          icon={Coffee}
          description="Danh mục, món, size và giá, topping; báo tạm hết, ẩn món khỏi màn bán hàng."
        />
        <Tabs defaultValue="items" className="gap-4">
          <TabsList className="h-11">
            <TabsTrigger value="items" className="px-4">
              Món
            </TabsTrigger>
            <TabsTrigger value="categories" className="px-4">
              Danh mục
            </TabsTrigger>
            <TabsTrigger value="toppings" className="px-4">
              Topping
            </TabsTrigger>
          </TabsList>
          <TabsContent value="items">
            <MenuItemsTab />
          </TabsContent>
          <TabsContent value="categories">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="toppings">
            <ToppingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGuard>
  )
}
