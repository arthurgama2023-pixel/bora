// ignore_for_file: unnecessary_getters_setters

import 'package:cloud_firestore/cloud_firestore.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class DeliveryRangeStruct extends FFFirebaseStruct {
  DeliveryRangeStruct({
    int? min,
    int? max,
    FirestoreUtilData firestoreUtilData = const FirestoreUtilData(),
  })  : _min = min,
        _max = max,
        super(firestoreUtilData);

  // "min" field.
  int? _min;
  int get min => _min ?? 0;
  set min(int? val) => _min = val;

  void incrementMin(int amount) => min = min + amount;

  bool hasMin() => _min != null;

  // "max" field.
  int? _max;
  int get max => _max ?? 0;
  set max(int? val) => _max = val;

  void incrementMax(int amount) => max = max + amount;

  bool hasMax() => _max != null;

  static DeliveryRangeStruct fromMap(Map<String, dynamic> data) =>
      DeliveryRangeStruct(
        min: castToType<int>(data['min']),
        max: castToType<int>(data['max']),
      );

  static DeliveryRangeStruct? maybeFromMap(dynamic data) => data is Map
      ? DeliveryRangeStruct.fromMap(data.cast<String, dynamic>())
      : null;

  Map<String, dynamic> toMap() => {
        'min': _min,
        'max': _max,
      }.withoutNulls;

  @override
  Map<String, dynamic> toSerializableMap() => {
        'min': serializeParam(
          _min,
          ParamType.int,
        ),
        'max': serializeParam(
          _max,
          ParamType.int,
        ),
      }.withoutNulls;

  static DeliveryRangeStruct fromSerializableMap(Map<String, dynamic> data) =>
      DeliveryRangeStruct(
        min: deserializeParam(
          data['min'],
          ParamType.int,
          false,
        ),
        max: deserializeParam(
          data['max'],
          ParamType.int,
          false,
        ),
      );

  @override
  String toString() => 'DeliveryRangeStruct(${toMap()})';

  @override
  bool operator ==(Object other) {
    return other is DeliveryRangeStruct && min == other.min && max == other.max;
  }

  @override
  int get hashCode => const ListEquality().hash([min, max]);
}

DeliveryRangeStruct createDeliveryRangeStruct({
  int? min,
  int? max,
  Map<String, dynamic> fieldValues = const {},
  bool clearUnsetFields = true,
  bool create = false,
  bool delete = false,
}) =>
    DeliveryRangeStruct(
      min: min,
      max: max,
      firestoreUtilData: FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
        delete: delete,
        fieldValues: fieldValues,
      ),
    );

DeliveryRangeStruct? updateDeliveryRangeStruct(
  DeliveryRangeStruct? deliveryRange, {
  bool clearUnsetFields = true,
  bool create = false,
}) =>
    deliveryRange
      ?..firestoreUtilData = FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
      );

void addDeliveryRangeStructData(
  Map<String, dynamic> firestoreData,
  DeliveryRangeStruct? deliveryRange,
  String fieldName, [
  bool forFieldValue = false,
]) {
  firestoreData.remove(fieldName);
  if (deliveryRange == null) {
    return;
  }
  if (deliveryRange.firestoreUtilData.delete) {
    firestoreData[fieldName] = FieldValue.delete();
    return;
  }
  final clearFields =
      !forFieldValue && deliveryRange.firestoreUtilData.clearUnsetFields;
  if (clearFields) {
    firestoreData[fieldName] = <String, dynamic>{};
  }
  final deliveryRangeData =
      getDeliveryRangeFirestoreData(deliveryRange, forFieldValue);
  final nestedData =
      deliveryRangeData.map((k, v) => MapEntry('$fieldName.$k', v));

  final mergeFields = deliveryRange.firestoreUtilData.create || clearFields;
  firestoreData
      .addAll(mergeFields ? mergeNestedFields(nestedData) : nestedData);
}

Map<String, dynamic> getDeliveryRangeFirestoreData(
  DeliveryRangeStruct? deliveryRange, [
  bool forFieldValue = false,
]) {
  if (deliveryRange == null) {
    return {};
  }
  final firestoreData = mapToFirestore(deliveryRange.toMap());

  // Add any Firestore field values
  mapToFirestore(deliveryRange.firestoreUtilData.fieldValues)
      .forEach((k, v) => firestoreData[k] = v);

  return forFieldValue ? mergeNestedFields(firestoreData) : firestoreData;
}

List<Map<String, dynamic>> getDeliveryRangeListFirestoreData(
  List<DeliveryRangeStruct>? deliveryRanges,
) =>
    deliveryRanges
        ?.map((e) => getDeliveryRangeFirestoreData(e, true))
        .toList() ??
    [];
