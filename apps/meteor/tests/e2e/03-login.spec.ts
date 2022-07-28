import { faker } from '@faker-js/faker';

import { test, expect } from './utils/test';
import { Auth } from './page-objects';

test.describe('Login', () => {
	let pageAuth: Auth;

	test.beforeEach(async ({ page }) => {
		pageAuth = new Auth(page);
		await page.goto('/');
	});

	test('expect to show a toast if the provided password is incorrect', async () => {
		await pageAuth.inputEmailOrUsername.type(faker.internet.email());
		await pageAuth.inputPassword.type('any_password');
		await pageAuth.btnSubmit.click();

		await expect(pageAuth.toastError).toBeVisible();
	});
});
