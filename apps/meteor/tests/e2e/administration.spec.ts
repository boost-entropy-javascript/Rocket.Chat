import { faker } from '@faker-js/faker';

import { IS_EE } from './config/constants';
import { Users } from './fixtures/userStates';
import { Admin } from './page-objects';
import { createTargetChannel } from './utils';
import { setSettingValueById } from './utils/setSettingValueById';
import { test, expect } from './utils/test';

test.use({ storageState: Users.admin.state });

test.describe.parallel('administration', () => {
	let poAdmin: Admin;
	let targetChannel: string;

	test.beforeEach(async ({ page }) => {
		poAdmin = new Admin(page);
	});

	test.describe('Workspace', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/admin/info');
		});

		test('expect download info as JSON', async ({ page }) => {
			const [download] = await Promise.all([page.waitForEvent('download'), page.locator('button:has-text("Download info")').click()]);

			await expect(download.suggestedFilename()).toBe('statistics.json');
		});
	});

	test.describe('Engagement dashboard', () => {
		test('Should show upsell modal', async ({ page }) => {
			test.skip(IS_EE);
			await page.goto('/admin/engagement/users');

			await expect(page.locator('role=dialog[name="Engagement dashboard"]')).toBeVisible();
		});

		test('Should show engagement dashboard', async ({ page }) => {
			test.skip(!IS_EE);
			await page.goto('/admin/engagement/users');

			await expect(page.locator('h1 >> text="Engagement"')).toBeVisible();
		});
	});

	test.describe('Device management', () => {
		test('Should show upsell modal', async ({ page }) => {
			test.skip(IS_EE);
			await page.goto('/admin/device-management');

			await expect(page.locator('role=dialog[name="Device management"]')).toBeVisible();
		});

		test('Should show device management page', async ({ page }) => {
			test.skip(!IS_EE);
			await page.goto('/admin/device-management');

			await expect(page.locator('h1 >> text="Device management"')).toBeVisible();
		});
	});

	test.describe('Users', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/admin/users');
		});

		test('expect find "user1" user', async ({ page }) => {
			await poAdmin.inputSearchUsers.type('user1');

			await expect(page.locator('table tr[qa-user-id="user1"]')).toBeVisible();
		});

		test('expect create a user', async () => {
			await poAdmin.tabs.users.btnNewUser.click();
			await poAdmin.tabs.users.inputName.type(faker.person.firstName());
			await poAdmin.tabs.users.inputUserName.type(faker.internet.userName());
			await poAdmin.tabs.users.inputEmail.type(faker.internet.email());
			await poAdmin.tabs.users.checkboxVerified.click();
			await poAdmin.tabs.users.inputPassword.type('any_password');
			await expect(poAdmin.tabs.users.userRole).toBeVisible();
			await poAdmin.tabs.users.btnSave.click();
		});

		test('expect SMTP setup warning and routing to email settings', async ({ page }) => {
			await poAdmin.tabs.users.btnInvite.click();
			await poAdmin.tabs.users.setupSmtpLink.click();
			await expect(page).toHaveURL('/admin/settings/Email');
		});
	});

	test.describe('Rooms', () => {
		test.beforeAll(async ({ api }) => {
			targetChannel = await createTargetChannel(api);
		});
		test.beforeEach(async ({ page }) => {
			await page.goto('/admin/rooms');
		});

		test('should find "general" channel', async ({ page }) => {
			await poAdmin.inputSearchRooms.type('general');
			await page.waitForSelector('[qa-room-id="GENERAL"]');
		});

		test('should edit target channel name', async () => {
			await poAdmin.inputSearchRooms.fill(targetChannel);
			await poAdmin.getRoomRow(targetChannel).click();
			await poAdmin.roomNameInput.fill(`${targetChannel}-edited`);
			await poAdmin.btnSave.click();

			await expect(poAdmin.getRoomRow(targetChannel)).toContainText(`${targetChannel}-edited`);

			targetChannel = `${targetChannel}-edited`;
		});

		test('should edit target channel type', async () => {
			await poAdmin.inputSearchRooms.type(targetChannel);
			await poAdmin.getRoomRow(targetChannel).click();
			await poAdmin.privateLabel.click();
			await poAdmin.btnSave.click();
			await expect(poAdmin.getRoomRow(targetChannel)).toContainText('Private Channel');
		});

		test('should archive target channel', async () => {
			await poAdmin.inputSearchRooms.type(targetChannel);
			await poAdmin.getRoomRow(targetChannel).click();
			await poAdmin.archivedLabel.click();
			await poAdmin.btnSave.click();

			await poAdmin.getRoomRow(targetChannel).click();
			await expect(poAdmin.archivedInput).toBeChecked();
		});

		test.describe.serial('Default rooms', () => {
			test('expect target channel to be default', async () => {
				await poAdmin.inputSearchRooms.type(targetChannel);
				await poAdmin.getRoomRow(targetChannel).click();
				await poAdmin.defaultLabel.click();

				await test.step('should close contextualbar after saving', async () => {
					await poAdmin.btnSave.click();
					await expect(poAdmin.page).toHaveURL(new RegExp('/admin/rooms$'));
				});

				await poAdmin.getRoomRow(targetChannel).click();
				await expect(poAdmin.defaultInput).toBeChecked();
			});

			test('should mark target default channel as "favorite by default"', async () => {
				await poAdmin.inputSearchRooms.type(targetChannel);
				await poAdmin.getRoomRow(targetChannel).click();
				await poAdmin.favoriteLabel.click();
				await poAdmin.btnSave.click();

				await poAdmin.getRoomRow(targetChannel).click();
				await expect(poAdmin.favoriteInput).toBeChecked();
			});

			test('should see favorite switch disabled when default is not true', async () => {
				await poAdmin.inputSearchRooms.type(targetChannel);
				await poAdmin.getRoomRow(targetChannel).click();
				await poAdmin.defaultLabel.click();

				await expect(poAdmin.favoriteInput).toBeDisabled();
			});

			test('should see favorite switch enabled when default is true', async () => {
				await poAdmin.inputSearchRooms.type(targetChannel);
				await poAdmin.getRoomRow(targetChannel).click();

				await expect(poAdmin.favoriteInput).toBeEnabled();
			});
		});
	});

	test.describe('Permissions', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/admin/permissions');
		});

		test('expect open upsell modal if not enterprise', async ({ page }) => {
			test.skip(IS_EE);
			await poAdmin.btnCreateRole.click();
			await page.waitForSelector('role=dialog[name="Custom roles"]');
		});

		test.describe('Users in role', () => {
			const channelName = faker.string.uuid();
			test.beforeAll(async ({ api }) => {
				// TODO: refactor createChannel utility in order to get channel data when creating 
				const response = await api.post('/channels.create', { name: channelName, members: ['user1'] });
				const { channel } = await response.json();

				await api.post('/channels.addOwner', { roomId: channel._id, userId: Users.user1.data._id });
				await api.post('/channels.removeOwner', { roomId: channel._id, userId: Users.admin.data._id });
			})

			test('admin should be able to get the owners of a room that wasnt created by him', async ({ page }) => {
				await poAdmin.openRoleByName('Owner').click();
				await poAdmin.btnUsersInRole.click();
				await poAdmin.inputRoom.fill(channelName);
				await page.getByRole('option', { name: channelName }).click();
				
				await expect(poAdmin.getUserRowByUsername('user1')).toBeVisible();
			})
		})
	});

	test.describe('Mailer', () => {
		test.beforeEach(async ({ page }) => {
			await page.goto('/admin/mailer');
		});

		test('should not have any accessibility violations', async ({ makeAxeBuilder }) => {
			const results = await makeAxeBuilder().analyze();
			expect(results.violations).toEqual([]);
		});
	});

	test.describe('Settings', () => {
		test.describe('General', () => {
			test.beforeEach(async ({ page }) => {
				await page.goto('/admin/settings/General');
			});

			test.afterAll(async ({ api }) => {
				await setSettingValueById(api, 'Language', 'en')
			});

			test('expect be able to reset a setting after a change', async () => {
				await poAdmin.inputSiteURL.type('any_text');
				await poAdmin.btnResetSiteURL.click();
			});
		});
	});
});
