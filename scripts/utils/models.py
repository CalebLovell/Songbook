import logging
import operator
import os

import numpy as np

from .helpers import get_settings, get_model_labels, MODEL_NAME, MODEL_PATH

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['CUDA_VISIBLE_DEVICES'] = ''
np.set_printoptions(legacy="1.21")

from ai_edge_litert import interpreter as tflite  # noqa: E402 -- reads the environment set above

log = logging.getLogger(__name__)


def get_model():
    return BirdNetV2_4(get_settings().getfloat('SENSITIVITY'))


class BirdNetV2_4:
    chunk_duration = 3
    sample_rate = 48000

    def __init__(self, sens):
        model_path = os.path.join(MODEL_PATH, f'{MODEL_NAME}.tflite')
        self.interpreter = tflite.Interpreter(model_path)
        self.interpreter.allocate_tensors()
        self._input_layer_idx = self.interpreter.get_input_details()[0]['index']
        self._output_layer_idx = self.interpreter.get_output_details()[0]['index']

        self.labels = get_model_labels()
        self._mdata_model = MDataModel(get_settings().getfloat('SF_THRESH'))
        self._sensitivity = max(0.5, min(1.0 - (sens - 1.0), 1.5))

    def scale(self, logits):
        return 1 / (1.0 + np.exp(-self._sensitivity * logits))

    def label(self, logits):
        p_labels = dict(zip(self.labels, logits))
        return sorted(p_labels.items(), key=operator.itemgetter(1), reverse=True)

    def predict(self, chunk):
        self.interpreter.set_tensor(self._input_layer_idx, np.array(chunk, dtype='float32')[np.newaxis, :])

        self.interpreter.invoke()
        logits = self.interpreter.get_tensor(self._output_layer_idx)[0]

        return self.label(self.scale(logits))

    def set_meta_data(self, lat, lon, week):
        self._mdata_model.set_meta_data(lat, lon, week)

    def get_species_list(self):
        return self._mdata_model.get_species_list(self.labels)


class MDataModel:
    model_name = 'BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16'

    def __init__(self, sf_thresh):
        model_path = os.path.join(MODEL_PATH, f'{self.model_name}.tflite')
        self.interpreter = tflite.Interpreter(model_path)
        self.interpreter.allocate_tensors()
        input_details = self.interpreter.get_input_details()
        output_details = self.interpreter.get_output_details()

        self._input_layer_idx = input_details[0]['index']
        self._output_layer_idx = output_details[0]['index']
        self._sf_thresh = sf_thresh

        self._mdata_params = None
        self._mdata = None

    def set_meta_data(self, lat, lon, week):
        if self._mdata_params != (lat, lon, week):
            self._mdata = None
        self._mdata_params = (lat, lon, week)

    def get_species_list_details(self, labels):
        if self._mdata is None:
            lat, lon, week = self._mdata_params
            sample = np.expand_dims(np.array([lat, lon, week], dtype='float32'), 0)

            # Run inference
            self.interpreter.set_tensor(self._input_layer_idx, sample)
            self.interpreter.invoke()

            l_filter = self.interpreter.get_tensor(self._output_layer_idx)[0]

            # Apply threshold
            l_filter = np.where(l_filter >= float(self._sf_thresh), l_filter, 0)

            # Zip with labels
            l_filter = list(zip(l_filter, labels))

            # Sort by filter value
            l_filter = sorted(l_filter, key=lambda x: x[0], reverse=True)

            self._mdata = [s for s in l_filter if s[0] >= self._sf_thresh]

        return self._mdata

    def get_species_list(self, labels):
        l_filter = self.get_species_list_details(labels)
        return [s[1].split('_')[0] for s in l_filter]
