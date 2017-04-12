from __future__ import unicode_literals
from django.db import models
from django.utils.translation import ugettext_lazy as _
import datetime
from django.contrib.postgres.fields import JSONField
# Create your models here.


class CPUArchitecture(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(_('CPU Architecture Name'), max_length=50, blank=False, unique=True)
    enabled = models.BooleanField(default=False)

    def __unicode__(self):
        return self.name


class GPUType(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(_('GPU Type Name'), max_length=50, blank=False, unique=True)
    enabled = models.BooleanField(default=False)

    def __unicode__(self):
        return self.name


class Platform(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(_('Platform Name'), max_length=50, blank=False, unique=True)
    enabled = models.BooleanField(default=False)

    def __unicode__(self):
        return self.name


class Bot(models.Model):
    password = models.CharField(_('Bot Password'), max_length=100, blank=False, unique=True)
    name = models.CharField(_('Bot Name'), max_length=50, blank=False, unique=True, primary_key=True)
    cpuArchitecture = models.ForeignKey(CPUArchitecture, blank=False, null=False, related_name='cpu_relation')
    cpuDetail = models.CharField(_('CPU Details'), max_length=100, blank=True, unique=False)
    gpuType = models.ForeignKey(GPUType, blank=False, null=False, related_name='gpu_relation')
    gpuDetail = models.CharField(_('GPU Details'), max_length=100, blank=True, unique=False)
    platform = models.ForeignKey(Platform, blank=False, null=False, related_name='platform_relation')
    platformDetail = models.CharField(_('Platform Details'), max_length=100, blank=True, unique=False)
    enabled = models.BooleanField(default=False)

    def is_authenticated(self):
        return True

    def __unicode__(self):
        return self.name

    def save(self, force_insert=False, force_update=False, using=None,
             update_fields=None):
        if not self.cpuArchitecture.enabled:
            raise ValueError("The CPU Type is not enabled")
        if not self.gpuType.enabled:
            raise ValueError("The GPU type is not enabled")
        if not self.platform.enabled:
            raise ValueError("The Platform is not enabled")

        super(Bot,self).save()


class Browser(models.Model):
    id = models.CharField(_('Browser Id'), max_length=50, primary_key = True)
    name = models.CharField(_('Browser Name'), max_length=50, blank=False, unique=False)
    enabled = models.BooleanField(default=False)

    def __unicode__(self):
        return self.name


class Test(models.Model):
    id = models.CharField(_('Test Id'), max_length=50, primary_key = True)
    description = models.CharField(_('Test Description'), max_length=150, blank=True, unique=False)
    url = models.CharField(_('Test URL'), max_length=150, blank=True, unique=False)
    enabled = models.BooleanField(default=False)

    def __unicode__(self):
        return self.id


IS_BETTER_CHOICES = (
    ('dw', 'Down'),
    ('up', 'Up'),
)


class MetricUnit(models.Model):
    name = models.CharField(_('Metric Name'), max_length=50, primary_key=True)
    unit = models.CharField(_('Metric Unit'), max_length=10, blank=True, unique=False)
    description = models.CharField(_('Metric Description'), max_length=150, blank=True, unique=False)
    prefix = JSONField()
    is_better = models.CharField(_('Is Better'), max_length=2, choices=IS_BETTER_CHOICES, default='dw')

    def __unicode__(self):
        return self.name


AGGREGATION_CHOICES = (
    ('None', 'None'),
    ('Total', 'Total'),
    ('Arithmetic', 'Arithmetic'),
    ('Geometric', 'Geometric'),
)


class BotReportDataManger(models.Manager):
    def create_report(self, bot, browser, browser_version, root_test, test_path, test_version, aggregation,
                      metric_tested, mean_value, stddev, delta, is_improvement,prev_result,timestamp=None):
        bot_report_data = self.create(bot=bot, browser=browser, browser_version=browser_version, root_test=root_test,
                                      test_path=test_path, test_version=test_version, aggregation=aggregation,
                                      metric_tested=metric_tested, mean_value=mean_value, stddev=stddev, delta=delta,
                                      is_improvement=is_improvement, prev_result=prev_result, timestamp=timestamp)
        return bot_report_data


class BotReportData(models.Model):
    id = models.AutoField(primary_key=True)
    bot = models.ForeignKey(Bot, blank=False, null=False, related_name='bot_relation', related_query_name='bot_relation')
    browser = models.ForeignKey(Browser, blank=False, null=False)
    browser_version = models.CharField(_('Browser Version'), max_length=500, blank=True, unique=False)
    root_test = models.ForeignKey(Test, blank=False, null=False, related_name='root_test')
    test_path = models.CharField(_('Test Path'), max_length=500, blank=True, unique=False)
    test_version = models.CharField(_('Test Version'), max_length=500, blank=True, unique=False)
    aggregation = models.CharField(_('Aggregation'), max_length=50, choices=AGGREGATION_CHOICES, default='na')
    metric_tested = models.ForeignKey(MetricUnit, blank=False, null=False)
    mean_value = models.FloatField(_('Mean Value'),null=True, blank=True)
    stddev = models.FloatField(_('Standard Deviation'),null=True, blank=True)
    delta = models.FloatField(_('Delta Field'), null=True, blank=True, default=0.00)
    timestamp = models.DateTimeField()
    is_improvement = models.BooleanField(default=False)
    prev_result = models.ForeignKey('self', blank=True, null=True, related_name='prev_results')

    objects = BotReportDataManger()

    def save(self, *args, **kwargs):
        if self.timestamp is None:
            self.timestamp = datetime.datetime.utcnow()
        super(BotReportData, self).save(*args, **kwargs)

    def __unicode__(self):
        return self.bot.name + ":" + str(self.browser) + ":" + self.test_version + ":" +\
               self.test_path + ":" + str(self.mean_value)