// ignore_for_file: unnecessary_getters_setters

import 'package:cloud_firestore/cloud_firestore.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class SegundoStruct extends FFFirebaseStruct {
  SegundoStruct({
    int? id,
    String? name,
    String? price,
    String? customPrice,
    String? discount,
    String? currency,
    int? deliveryTime,
    DeliveryRangeStruct? deliveryRange,
    CompanyStruct? company,
    FirestoreUtilData firestoreUtilData = const FirestoreUtilData(),
  })  : _id = id,
        _name = name,
        _price = price,
        _customPrice = customPrice,
        _discount = discount,
        _currency = currency,
        _deliveryTime = deliveryTime,
        _deliveryRange = deliveryRange,
        _company = company,
        super(firestoreUtilData);

  // "id" field.
  int? _id;
  int get id => _id ?? 0;
  set id(int? val) => _id = val;

  void incrementId(int amount) => id = id + amount;

  bool hasId() => _id != null;

  // "name" field.
  String? _name;
  String get name => _name ?? '';
  set name(String? val) => _name = val;

  bool hasName() => _name != null;

  // "price" field.
  String? _price;
  String get price => _price ?? '';
  set price(String? val) => _price = val;

  bool hasPrice() => _price != null;

  // "custom_price" field.
  String? _customPrice;
  String get customPrice => _customPrice ?? '';
  set customPrice(String? val) => _customPrice = val;

  bool hasCustomPrice() => _customPrice != null;

  // "discount" field.
  String? _discount;
  String get discount => _discount ?? '';
  set discount(String? val) => _discount = val;

  bool hasDiscount() => _discount != null;

  // "currency" field.
  String? _currency;
  String get currency => _currency ?? '';
  set currency(String? val) => _currency = val;

  bool hasCurrency() => _currency != null;

  // "delivery_time" field.
  int? _deliveryTime;
  int get deliveryTime => _deliveryTime ?? 0;
  set deliveryTime(int? val) => _deliveryTime = val;

  void incrementDeliveryTime(int amount) =>
      deliveryTime = deliveryTime + amount;

  bool hasDeliveryTime() => _deliveryTime != null;

  // "delivery_range" field.
  DeliveryRangeStruct? _deliveryRange;
  DeliveryRangeStruct get deliveryRange =>
      _deliveryRange ?? DeliveryRangeStruct();
  set deliveryRange(DeliveryRangeStruct? val) => _deliveryRange = val;

  void updateDeliveryRange(Function(DeliveryRangeStruct) updateFn) {
    updateFn(_deliveryRange ??= DeliveryRangeStruct());
  }

  bool hasDeliveryRange() => _deliveryRange != null;

  // "company" field.
  CompanyStruct? _company;
  CompanyStruct get company => _company ?? CompanyStruct();
  set company(CompanyStruct? val) => _company = val;

  void updateCompany(Function(CompanyStruct) updateFn) {
    updateFn(_company ??= CompanyStruct());
  }

  bool hasCompany() => _company != null;

  static SegundoStruct fromMap(Map<String, dynamic> data) => SegundoStruct(
        id: castToType<int>(data['id']),
        name: data['name'] as String?,
        price: data['price'] as String?,
        customPrice: data['custom_price'] as String?,
        discount: data['discount'] as String?,
        currency: data['currency'] as String?,
        deliveryTime: castToType<int>(data['delivery_time']),
        deliveryRange: data['delivery_range'] is DeliveryRangeStruct
            ? data['delivery_range']
            : DeliveryRangeStruct.maybeFromMap(data['delivery_range']),
        company: data['company'] is CompanyStruct
            ? data['company']
            : CompanyStruct.maybeFromMap(data['company']),
      );

  static SegundoStruct? maybeFromMap(dynamic data) =>
      data is Map ? SegundoStruct.fromMap(data.cast<String, dynamic>()) : null;

  Map<String, dynamic> toMap() => {
        'id': _id,
        'name': _name,
        'price': _price,
        'custom_price': _customPrice,
        'discount': _discount,
        'currency': _currency,
        'delivery_time': _deliveryTime,
        'delivery_range': _deliveryRange?.toMap(),
        'company': _company?.toMap(),
      }.withoutNulls;

  @override
  Map<String, dynamic> toSerializableMap() => {
        'id': serializeParam(
          _id,
          ParamType.int,
        ),
        'name': serializeParam(
          _name,
          ParamType.String,
        ),
        'price': serializeParam(
          _price,
          ParamType.String,
        ),
        'custom_price': serializeParam(
          _customPrice,
          ParamType.String,
        ),
        'discount': serializeParam(
          _discount,
          ParamType.String,
        ),
        'currency': serializeParam(
          _currency,
          ParamType.String,
        ),
        'delivery_time': serializeParam(
          _deliveryTime,
          ParamType.int,
        ),
        'delivery_range': serializeParam(
          _deliveryRange,
          ParamType.DataStruct,
        ),
        'company': serializeParam(
          _company,
          ParamType.DataStruct,
        ),
      }.withoutNulls;

  static SegundoStruct fromSerializableMap(Map<String, dynamic> data) =>
      SegundoStruct(
        id: deserializeParam(
          data['id'],
          ParamType.int,
          false,
        ),
        name: deserializeParam(
          data['name'],
          ParamType.String,
          false,
        ),
        price: deserializeParam(
          data['price'],
          ParamType.String,
          false,
        ),
        customPrice: deserializeParam(
          data['custom_price'],
          ParamType.String,
          false,
        ),
        discount: deserializeParam(
          data['discount'],
          ParamType.String,
          false,
        ),
        currency: deserializeParam(
          data['currency'],
          ParamType.String,
          false,
        ),
        deliveryTime: deserializeParam(
          data['delivery_time'],
          ParamType.int,
          false,
        ),
        deliveryRange: deserializeStructParam(
          data['delivery_range'],
          ParamType.DataStruct,
          false,
          structBuilder: DeliveryRangeStruct.fromSerializableMap,
        ),
        company: deserializeStructParam(
          data['company'],
          ParamType.DataStruct,
          false,
          structBuilder: CompanyStruct.fromSerializableMap,
        ),
      );

  @override
  String toString() => 'SegundoStruct(${toMap()})';

  @override
  bool operator ==(Object other) {
    return other is SegundoStruct &&
        id == other.id &&
        name == other.name &&
        price == other.price &&
        customPrice == other.customPrice &&
        discount == other.discount &&
        currency == other.currency &&
        deliveryTime == other.deliveryTime &&
        deliveryRange == other.deliveryRange &&
        company == other.company;
  }

  @override
  int get hashCode => const ListEquality().hash([
        id,
        name,
        price,
        customPrice,
        discount,
        currency,
        deliveryTime,
        deliveryRange,
        company
      ]);
}

SegundoStruct createSegundoStruct({
  int? id,
  String? name,
  String? price,
  String? customPrice,
  String? discount,
  String? currency,
  int? deliveryTime,
  DeliveryRangeStruct? deliveryRange,
  CompanyStruct? company,
  Map<String, dynamic> fieldValues = const {},
  bool clearUnsetFields = true,
  bool create = false,
  bool delete = false,
}) =>
    SegundoStruct(
      id: id,
      name: name,
      price: price,
      customPrice: customPrice,
      discount: discount,
      currency: currency,
      deliveryTime: deliveryTime,
      deliveryRange:
          deliveryRange ?? (clearUnsetFields ? DeliveryRangeStruct() : null),
      company: company ?? (clearUnsetFields ? CompanyStruct() : null),
      firestoreUtilData: FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
        delete: delete,
        fieldValues: fieldValues,
      ),
    );

SegundoStruct? updateSegundoStruct(
  SegundoStruct? segundo, {
  bool clearUnsetFields = true,
  bool create = false,
}) =>
    segundo
      ?..firestoreUtilData = FirestoreUtilData(
        clearUnsetFields: clearUnsetFields,
        create: create,
      );

void addSegundoStructData(
  Map<String, dynamic> firestoreData,
  SegundoStruct? segundo,
  String fieldName, [
  bool forFieldValue = false,
]) {
  firestoreData.remove(fieldName);
  if (segundo == null) {
    return;
  }
  if (segundo.firestoreUtilData.delete) {
    firestoreData[fieldName] = FieldValue.delete();
    return;
  }
  final clearFields =
      !forFieldValue && segundo.firestoreUtilData.clearUnsetFields;
  if (clearFields) {
    firestoreData[fieldName] = <String, dynamic>{};
  }
  final segundoData = getSegundoFirestoreData(segundo, forFieldValue);
  final nestedData = segundoData.map((k, v) => MapEntry('$fieldName.$k', v));

  final mergeFields = segundo.firestoreUtilData.create || clearFields;
  firestoreData
      .addAll(mergeFields ? mergeNestedFields(nestedData) : nestedData);
}

Map<String, dynamic> getSegundoFirestoreData(
  SegundoStruct? segundo, [
  bool forFieldValue = false,
]) {
  if (segundo == null) {
    return {};
  }
  final firestoreData = mapToFirestore(segundo.toMap());

  // Handle nested data for "delivery_range" field.
  addDeliveryRangeStructData(
    firestoreData,
    segundo.hasDeliveryRange() ? segundo.deliveryRange : null,
    'delivery_range',
    forFieldValue,
  );

  // Handle nested data for "company" field.
  addCompanyStructData(
    firestoreData,
    segundo.hasCompany() ? segundo.company : null,
    'company',
    forFieldValue,
  );

  // Add any Firestore field values
  mapToFirestore(segundo.firestoreUtilData.fieldValues)
      .forEach((k, v) => firestoreData[k] = v);

  return forFieldValue ? mergeNestedFields(firestoreData) : firestoreData;
}

List<Map<String, dynamic>> getSegundoListFirestoreData(
  List<SegundoStruct>? segundos,
) =>
    segundos?.map((e) => getSegundoFirestoreData(e, true)).toList() ?? [];
