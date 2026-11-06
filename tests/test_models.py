import unittest
from unittest.mock import patch

import numpy as np

from scripts.utils.helpers import get_model_labels
from scripts.utils.models import BirdNetV2_4, MDataModel, get_model
from tests.helpers import Settings

REMOVED_MODELS = ['BirdNET_6K_GLOBAL_MODEL', 'Perch_v2', 'BirdNET-Go_classifier_20250916']


class TestRemovedModelFallback(unittest.TestCase):
    """A station's birdnet.conf can still name a model that no longer ships."""

    def _settings(self, model):
        settings = Settings.with_defaults()
        settings['MODEL'] = model
        return settings

    def test_analysis_runs_on_v2_4(self):
        for model in REMOVED_MODELS:
            with self.subTest(model=model), patch('scripts.utils.helpers._load_settings', return_value=self._settings(model)):
                analyzer = get_model()
                self.assertIsInstance(analyzer, BirdNetV2_4)
                self.assertIsInstance(analyzer._mdata_model, MDataModel)

                silence = np.zeros(analyzer.chunk_duration * analyzer.sample_rate)
                self.assertEqual(len(analyzer.predict(silence)), len(analyzer.labels))

                analyzer.set_meta_data(52.1, 5.1, 20)
                self.assertTrue(analyzer.get_species_list())

    def test_location_filter_ignores_a_stale_version(self):
        settings = Settings.with_defaults()
        settings['DATA_MODEL_VERSION'] = 1
        with patch('scripts.utils.helpers._load_settings', return_value=settings):
            self.assertEqual(get_model()._mdata_model.model_name, 'BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16')

    def test_labels_come_from_v2_4(self):
        for model in REMOVED_MODELS:
            with self.subTest(model=model), patch('scripts.utils.helpers._load_settings', return_value=self._settings(model)):
                self.assertEqual(len(get_model_labels()), 6522)


if __name__ == '__main__':
    unittest.main()
