import { test, expect } from './utils/test';
import { Auth, OmnichannelDepartaments } from './page-objects';

test.describe('Department', () => {
	let pageAuth: Auth;
	let pageOmnichannelDepartaments: OmnichannelDepartaments;

	test.beforeEach(async ({ page }) => {
		pageAuth = new Auth(page);
		pageOmnichannelDepartaments = new OmnichannelDepartaments(page);
	});

	test.beforeEach(async ({ page }) => {
		await pageAuth.doLogin();
		await page.goto('/omnichannel');
	});

	test.describe('Actions', async () => {
		test.beforeEach(async () => {
			await pageOmnichannelDepartaments.departmentsLink.click();
		});

		test.describe('Create and Edit', async () => {
			test('expect new department is created', async () => {
				await pageOmnichannelDepartaments.btnNewDepartment.click();
				await pageOmnichannelDepartaments.doAddDepartments();
				await expect(pageOmnichannelDepartaments.departmentAdded).toBeVisible();
			});

			test('expect department is edited', async () => {
				await pageOmnichannelDepartaments.departmentAdded.click();
				await pageOmnichannelDepartaments.doEditDepartments();
				await expect(pageOmnichannelDepartaments.departmentAdded).toHaveText('any_name_edit');
			});
		});

		test.describe('Delete department', () => {
			test.beforeEach(async () => {
				await pageOmnichannelDepartaments.btnTableDeleteDepartment.click();
			});

			test('expect dont show dialog on cancel delete department', async () => {
				await pageOmnichannelDepartaments.btnModalCancelDeleteDepartment.click();
				await expect(pageOmnichannelDepartaments.modalDepartment).not.toBeVisible();
				await expect(pageOmnichannelDepartaments.departmentAdded).toBeVisible();
			});

			test('expect delete departments', async () => {
				await pageOmnichannelDepartaments.btnModalDeleteDepartment.click();
				await expect(pageOmnichannelDepartaments.modalDepartment).not.toBeVisible();
				await expect(pageOmnichannelDepartaments.departmentAdded).not.toBeVisible();
			});
		});
	});
});
