import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function AdminSettings() {
  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">System configuration and preferences</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              System settings and configuration options will be available here.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membership Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Level I</span>
                <span>KES 5,000 → 10,000</span>
              </div>
              <div className="flex justify-between">
                <span>Level II</span>
                <span>KES 10,000 → 20,000</span>
              </div>
              <div className="flex justify-between">
                <span>Level III</span>
                <span>KES 20,000 → 40,000</span>
              </div>
              <div className="flex justify-between">
                <span>Level IV</span>
                <span>KES 40,000 → 80,000</span>
              </div>
              <div className="flex justify-between">
                <span>Level V</span>
                <span>KES 60,000 → 120,000</span>
              </div>
              <div className="flex justify-between">
                <span>Level VI</span>
                <span>KES 80,000 → 160,000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fee Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Registration Fee</span>
                <span>KES 500</span>
              </div>
              <div className="flex justify-between">
                <span>Management Fee</span>
                <span>KES 1,000</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rollover Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• 10% unused balance rolls over yearly</p>
              <p>• Maximum rollover period: 3 years</p>
              <p>• Rollover calculated at end of membership year</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
