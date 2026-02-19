import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create permissions
  const permissions = [
    { code: 'vendor:create', name: 'Create Vendor', resource: 'vendor', action: 'create' },
    { code: 'vendor:read', name: 'Read Vendor', resource: 'vendor', action: 'read' },
    { code: 'vendor:update', name: 'Update Vendor', resource: 'vendor', action: 'update' },
    { code: 'vendor:delete', name: 'Delete Vendor', resource: 'vendor', action: 'delete' },
    { code: 'vendor:submit', name: 'Submit Vendor', resource: 'vendor', action: 'submit' },
    { code: 'vendor:approve', name: 'Approve Vendor', resource: 'vendor', action: 'approve' },
    { code: 'vendor:reject', name: 'Reject Vendor', resource: 'vendor', action: 'reject' },
    { code: 'vendor:terminate', name: 'Terminate Vendor', resource: 'vendor', action: 'terminate' },
    { code: 'vendor:resubmit', name: 'Resubmit Vendor', resource: 'vendor', action: 'resubmit' },
    { code: 'compliance:template:create', name: 'Create Compliance Template', resource: 'compliance', action: 'template:create' },
    { code: 'compliance:template:read', name: 'Read Compliance Template', resource: 'compliance', action: 'template:read' },
    { code: 'compliance:assign', name: 'Assign Compliance', resource: 'compliance', action: 'assign' },
    { code: 'compliance:update', name: 'Update Compliance', resource: 'compliance', action: 'update' },
    { code: 'compliance:read', name: 'Read Compliance', resource: 'compliance', action: 'read' },
    { code: 'document:upload', name: 'Upload Document', resource: 'document', action: 'upload' },
    { code: 'document:read', name: 'Read Document', resource: 'document', action: 'read' },
    { code: 'document:verify', name: 'Verify Document', resource: 'document', action: 'verify' },
    { code: 'workflow:config:create', name: 'Create Workflow Config', resource: 'workflow', action: 'config:create' },
    { code: 'workflow:config:read', name: 'Read Workflow Config', resource: 'workflow', action: 'config:read' },
    { code: 'workflow:approve', name: 'Approve Workflow', resource: 'workflow', action: 'approve' },
    { code: 'workflow:reject', name: 'Reject Workflow', resource: 'workflow', action: 'reject' },
    { code: 'workflow:delegate', name: 'Delegate Workflow', resource: 'workflow', action: 'delegate' },
    { code: 'user:create', name: 'Create User', resource: 'user', action: 'create' },
    { code: 'user:read', name: 'Read User', resource: 'user', action: 'read' },
    { code: 'user:update', name: 'Update User', resource: 'user', action: 'update' },
    { code: 'user:role:assign', name: 'Assign Role', resource: 'user', action: 'role:assign' },
    { code: 'audit:read:full', name: 'Full Audit Read', resource: 'audit', action: 'read:full' },
    { code: 'audit:read:restricted', name: 'Restricted Audit Read', resource: 'audit', action: 'read:restricted' },
    { code: 'audit:export', name: 'Export Audit', resource: 'audit', action: 'export' },
    { code: 'audit:verify', name: 'Verify Audit', resource: 'audit', action: 'verify' },
    { code: 'admin:system:config', name: 'System Config', resource: 'admin', action: 'system:config' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }

  console.log('Created permissions');

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'System Administrator', isSystem: true },
  });

  const complianceRole = await prisma.role.upsert({
    where: { name: 'COMPLIANCE_OFFICER' },
    update: {},
    create: { name: 'COMPLIANCE_OFFICER', description: 'Compliance Officer', isSystem: true },
  });

  const procurementRole = await prisma.role.upsert({
    where: { name: 'PROCUREMENT_MANAGER' },
    update: {},
    create: { name: 'PROCUREMENT_MANAGER', description: 'Procurement Manager', isSystem: true },
  });

  const financeRole = await prisma.role.upsert({
    where: { name: 'FINANCE_REVIEWER' },
    update: {},
    create: { name: 'FINANCE_REVIEWER', description: 'Finance Reviewer', isSystem: true },
  });

  const auditorRole = await prisma.role.upsert({
    where: { name: 'AUDITOR' },
    update: {},
    create: { name: 'AUDITOR', description: 'Auditor', isSystem: true },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'VIEWER' },
    update: {},
    create: { name: 'VIEWER', description: 'Read-only Viewer', isSystem: true },
  });

  console.log('Created roles');

  // Create audit access scopes
  await prisma.auditAccessScope.upsert({
    where: { roleId: complianceRole.id },
    update: {},
    create: {
      roleId: complianceRole.id,
      allowedEntityTypes: ['Vendor', 'ComplianceItem', 'ComplianceChecklist', 'Document', 'OnboardingRequest'],
      allowedActions: ['CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'APPROVE', 'REJECT'],
      excludedFields: ['bankingInfo', 'taxId', 'bankAccountEncrypted', 'bankRoutingEncrypted', 'taxIdEncrypted'],
      dataRetentionDays: 365,
      canExport: false,
      canViewUserDetails: false,
    },
  });

  await prisma.auditAccessScope.upsert({
    where: { roleId: auditorRole.id },
    update: {},
    create: {
      roleId: auditorRole.id,
      allowedEntityTypes: [],
      allowedActions: [],
      excludedFields: [],
      dataRetentionDays: 2555,
      canExport: true,
      canViewUserDetails: true,
    },
  });

  console.log('Created audit access scopes');

  // Create vendor categories
  const categories = [
    { name: 'IT Services', description: 'Information Technology Services', riskWeight: 2 },
    { name: 'Professional Services', description: 'Consulting and Professional Services', riskWeight: 1 },
    { name: 'Manufacturing', description: 'Manufacturing and Production', riskWeight: 2 },
    { name: 'Financial Services', description: 'Banking and Financial Services', riskWeight: 3 },
    { name: 'Healthcare', description: 'Healthcare and Medical Services', riskWeight: 3 },
    { name: 'Logistics', description: 'Transportation and Logistics', riskWeight: 1 },
  ];

  for (const cat of categories) {
    await prisma.vendorCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log('Created vendor categories');

  // Create admin user
  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@voms.local' },
    update: {},
    create: {
      email: 'admin@voms.local',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log('Created admin user (admin@voms.local / Admin123!)');

  // Create sample compliance template
  const itCategory = await prisma.vendorCategory.findUnique({
    where: { name: 'IT Services' },
  });

  if (itCategory) {
    await prisma.complianceTemplate.upsert({
      where: { id: 'default-it-template' },
      update: {},
      create: {
        id: 'default-it-template',
        name: 'IT Vendor Compliance Checklist',
        description: 'Standard compliance checklist for IT service vendors',
        categoryId: itCategory.id,
        items: {
          create: [
            { name: 'Business License', description: 'Valid business license', itemOrder: 1, isRequired: true, documentRequired: true },
            { name: 'Insurance Certificate', description: 'General liability insurance', itemOrder: 2, isRequired: true, documentRequired: true },
            { name: 'SOC 2 Report', description: 'SOC 2 Type II compliance report', itemOrder: 3, isRequired: true, documentRequired: true },
            { name: 'Data Processing Agreement', description: 'Signed DPA', itemOrder: 4, isRequired: true, documentRequired: true },
            { name: 'Security Questionnaire', description: 'Completed security assessment', itemOrder: 5, isRequired: true, documentRequired: false },
            { name: 'References', description: 'Business references', itemOrder: 6, isRequired: false, documentRequired: false },
          ],
        },
      },
    });

    console.log('Created sample compliance template');
  }

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
