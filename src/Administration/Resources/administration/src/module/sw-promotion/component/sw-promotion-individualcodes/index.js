import { Component, Mixin } from 'src/core/shopware';
import { string } from 'src/core/service/util.service';
import { mapApiErrors } from 'src/app/service/map-errors.service';
import Criteria from 'src/core/data-new/criteria.data';
import IndividualCodeGenerator from '../../service/individual-code-generator.service';
import entityHydrator from '../../helper/code-entity-hydrator.helper';
import template from './sw-promotion-individualcodes.html.twig';
import './sw-promotion-individualcodes.scss';

/**
 * @description This component helps to manage individual
 * promotion codes as a standalone component.
 * Assign the required promotion Id along with a
 * prefilled code pattern. You can integrate this component
 * either directly in your view, or present it within a modal.
 * The following properties are required:
 *      - promotion: Promotion Entity
 */
Component.register('sw-promotion-individualcodes', {
    inject: ['repositoryFactory', 'context'],
    template,

    mixins: [
        Mixin.getByName('notification'),
        Mixin.getByName('placeholder')
    ],

    props: {
        promotion: {
            type: Object,
            required: true
        }
    },

    data() {
        return {
            // DI objects
            codeSaver: null,
            // local data
            codePattern: '',
            generateCount: 10,
            totalCodesCount: 0,
            // GRID data
            gridCurrentPageNr: 1,
            gridPageLimit: 10,
            gridPageDataSource: [],
            // local UI bindings
            deleteButtonDisabled: true,
            isGeneratingCodes: false,
            progressValue: 0,
            progressMax: 0,
            shouldStartGenerate: false
        };
    },
    computed: {
        gridPagesVisible() {
            return 7;
        },
        gridSteps() {
            return [10, 25, 50];
        },
        gridColumns() {
            return [
                {
                    property: 'code',
                    dataIndex: 'code',
                    label: this.getColumnCodesTitle(),
                    allowResize: false
                },
                {
                    property: 'isRedeemed',
                    dataIndex: 'isRedeemed',
                    label: this.$tc('sw-promotion.detail.main.general.codes.individual.columnRedeemed'),
                    allowResize: false
                },
                {
                    property: 'customerName',
                    dataIndex: 'customerName',
                    label: this.$tc('sw-promotion.detail.main.general.codes.individual.columnCustomer'),
                    allowResize: false
                }
            ];
        },
        gridItemsTotal() {
            return this.totalCodesCount;
        },
        isDeleteButtonDisabled() {
            return this.deleteButtonDisabled;
        },
        codePatternHelpText() {
            return this.$tc('sw-promotion.detail.main.general.codes.individual.helpTextPattern');
        },
        repository() {
            return this.repositoryFactory.create('promotion_individual_code');
        },
        isEditingDisabled() {
            if (this.promotion === null) {
                return false;
            }
            return this.promotion.hasOrders;
        },

        ...mapApiErrors('promotion', ['individualCodePattern'])
    },
    created() {
        this.createdComponent();
    },
    methods: {
        createdComponent() {
            this.codeGenerator = new IndividualCodeGenerator(this.promotion.id, this.repository, this.context);
            this.codeGenerator.on('generate-begin', this.onGenerateBegin);
            this.codeGenerator.on('generate-cleared', this.onGenerateCleared);
            this.codeGenerator.on('generate-progress', this.onGenerateProgress);
            this.codeGenerator.on('generate-end', this.onGenerateEnd);

            this.$root.$on('promotion-save-success', this.onContinueGenerate);
            this.$root.$on('promotion-save-error', this.onPromotionNotSaved);

            this.progressValue = 0;
            this.progressMax = this.generateCount;

            // immediately load our grid
            // and fill it with data
            this.refreshGridDataSource();
        },

        getColumnCodesTitle() {
            const count = this.totalCodesCount;
            const title = this.$tc('sw-promotion.detail.main.general.codes.individual.columnCode');
            return `${title} (${count})`;
        },

        onGenerateClick() {
            const snippetRoot = 'sw-promotion.detail.main.general.codes.individual.alerts';

            if (string.isEmptyOrSpaces(this.promotion.individualCodePattern)) {
                this.createNotificationError({
                    title: this.$tc(`${snippetRoot}.errorNoPatternTitle`),
                    message: this.$tc(`${snippetRoot}.errorNoPatternMessage`)
                });
                return;
            }

            this.shouldStartGenerate = true;
            this.$root.$emit('promotion-save-start');
        },

        onContinueGenerate() {
            // avoid that it might be triggered twice
            if (this.shouldStartGenerate) {
                this.codeGenerator.generateCodes(this.promotion.individualCodePattern, this.generateCount);
            }

            this.shouldStartGenerate = false;
        },

        onPromotionNotSaved() {
            this.shouldStartGenerate = false;
        },

        onGenerateBegin(data) {
            // turn on our loading indicator
            // for our generate-button
            this.isGeneratingCodes = true;

            this.progressValue = 0;
            this.progressMax = data.maxCount;
            this.generateCount = data.maxCount;
        },

        onGenerateCleared() {
            // we have cleared all old codes that were not redeemed
            // so lets clear our grid for now
            this.totalCodesCount = 0;
            this.gridPageDataSource = [];
        },

        onGenerateProgress(data) {
            this.progressValue = data.progress;
        },

        onGenerateEnd(result) {
            // turn off our loading indicator
            // for our generate-button
            this.isGeneratingCodes = false;

            // refresh our grid and
            // make sure everything is up to date
            this.refreshGridDataSource();

            const snippetRoot = 'sw-promotion.detail.main.general.codes.individual.alerts';

            this.createNotificationSuccess({
                title: this.$tc(`${snippetRoot}.successGeneratedTitle`),
                message: this.$tc(`${snippetRoot}.successGeneratedMessage`, 0, { count: result.count })
            });
        },

        onGridSelectionChanged(selection) {
            // enable our button if rows have been selected.
            // disable our delete button if nothing has been selected
            this.deleteButtonDisabled = Object.keys(selection).length <= 0;
        },

        onOpenCustomer(customerId) {
            const route = {
                name: 'sw.customer.detail',
                params: { id: customerId }
            };
            const routeData = this.$router.resolve(route);
            window.open(routeData.href, '_blank');
        },

        onDeleteCode(code) {
            this.deleteCode(code).then((success) => {
                if (success) {
                    this.refreshGridDataSource();
                }
            });
        },

        onDeleteSelectedCodes() {
            // delete all our selected
            // codes from our grid
            const selection = this.$refs.gridCodes.selection;
            Object.values(selection).forEach(code => {
                this.deleteCode(code).then((success) => {
                    if (success) {
                        this.refreshGridDataSource();
                    }
                });
            });

            // reset our selection in the grid
            // and also deselect the checkbox in the header
            this.$refs.gridCodes.selection = [];
            this.$refs.gridCodes.allSelectedChecked = false;

            // refresh our grid and
            // make sure everything is up to date
            this.refreshGridDataSource();
        },

        onPageChange(data) {
            // assign new pagination status data
            this.gridCurrentPageNr = data.page;
            this.gridPageLimit = data.limit;
            // refresh our grid
            this.refreshGridDataSource();
        },

        // this function deletes the
        // provided code from our active list
        // and makes sure it appears in our delete list
        async deleteCode(code) {
            let success = false;

            // check if it has already been redeemed.
            // if so, do not delete it!
            if (code.isRedeemed) {
                success = false;
            } else {
                // delete does not work automatically.
                // thus we iterate through ids that need to be deleted in here.
                // wait for this async call, because the calling
                // function might need to refresh our grid afterwards.
                const promise = await this.repository.delete(code.id, this.context)
                    .then(() => {
                        return true;
                    })
                    .catch(() => {
                        return false;
                    });

                // wait for result
                success = await promise;
            }

            if (success) {
                this.createNotificationSuccess({
                    title: this.$tc('sw-promotion.detail.main.general.codes.individual.alerts.successDeletedTitle'),
                    message: code.code
                });
                this.refreshGridDataSource();
                return true;
            }

            this.createNotificationError({
                title: this.$tc('sw-promotion.detail.main.general.codes.individual.alerts.errorDeletedTitle'),
                message: code.code
            });

            return false;
        },

        // this function refreshes our grid data source
        // by loading the data for the current page
        refreshGridDataSource() {
            const criteria = new Criteria();
            criteria.addFilter(Criteria.equals('promotionId', this.promotion.id));
            criteria.setPage(this.gridCurrentPageNr);
            criteria.setLimit(this.gridPageLimit);
            criteria.setTotalCountMode(1);

            // load all our individual codes of our promotion
            // into our local promotion object.
            this.repository.search(criteria, this.context).then((codeCollection) => {
                // assign our ui data
                this.totalCodesCount = codeCollection.total;
                this.gridPageDataSource = codeCollection;

                // now hydrate our objects.
                // we have some extensions for the entities
                // that we need to apply on these items.
                this.gridPageDataSource.forEach((code) => {
                    entityHydrator.hydrate(code);
                });

                // if we have no data on the current page
                // but still a total count, then this means
                // that we are on a page that has been removed due to
                // deleting some codes.
                // so just try to reduce the page and refresh again
                if (this.totalCodesCount > 0 && this.gridPageDataSource.length <= 0) {
                    // decrease, but stick with minimum of 1
                    this.gridCurrentPageNr = (this.gridCurrentPageNr === 1) ? 1 : this.gridCurrentPageNr -= 1;
                    this.refreshGridDataSource();
                }
            });
        }
    }
});
