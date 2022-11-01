import type { AppPricingPlan } from '@rocket.chat/core-typings';
import { Box, Tag } from '@rocket.chat/fuselage';
import { TranslationKey, useTranslation } from '@rocket.chat/ui-contexts';
import React, { FC, useMemo } from 'react';

import { formatPriceAndPurchaseType } from '../../../helpers';

type AppStatusPriceDisplayProps = {
	purchaseType: string;
	pricingPlans: AppPricingPlan[];
	price: number;
	showType?: boolean;
	marginInline?: string;
};

const AppStatusPriceDisplay: FC<AppStatusPriceDisplayProps> = ({ purchaseType, pricingPlans, price, showType = true }) => {
	const t = useTranslation();

	const { type, price: formattedPrice } = useMemo(
		() => formatPriceAndPurchaseType(purchaseType, pricingPlans, price),
		[purchaseType, pricingPlans, price],
	);

	return (
		<Tag>
			{showType && <Box color='default'>{t(type as TranslationKey)}</Box>}
			<Box>{!showType && type === 'Free' ? t(type) : formattedPrice}</Box>
		</Tag>
	);
};

export default AppStatusPriceDisplay;
