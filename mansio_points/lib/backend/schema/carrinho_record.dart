import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class CarrinhoRecord extends FirestoreRecord {
  CarrinhoRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "itens" field.
  List<DocumentReference>? _itens;
  List<DocumentReference> get itens => _itens ?? const [];
  bool hasItens() => _itens != null;

  // "dono" field.
  DocumentReference? _dono;
  DocumentReference? get dono => _dono;
  bool hasDono() => _dono != null;

  // "subtotal" field.
  double? _subtotal;
  double get subtotal => _subtotal ?? 0.0;
  bool hasSubtotal() => _subtotal != null;

  // "total" field.
  double? _total;
  double get total => _total ?? 0.0;
  bool hasTotal() => _total != null;

  // "frete" field.
  double? _frete;
  double get frete => _frete ?? 0.0;
  bool hasFrete() => _frete != null;

  // "data_modif" field.
  DateTime? _dataModif;
  DateTime? get dataModif => _dataModif;
  bool hasDataModif() => _dataModif != null;

  DocumentReference get parentReference => reference.parent.parent!;

  void _initializeFields() {
    _itens = getDataList(snapshotData['itens']);
    _dono = snapshotData['dono'] as DocumentReference?;
    _subtotal = castToType<double>(snapshotData['subtotal']);
    _total = castToType<double>(snapshotData['total']);
    _frete = castToType<double>(snapshotData['frete']);
    _dataModif = snapshotData['data_modif'] as DateTime?;
  }

  static Query<Map<String, dynamic>> collection([DocumentReference? parent]) =>
      parent != null
          ? parent.collection('carrinho')
          : FirebaseFirestore.instance.collectionGroup('carrinho');

  static DocumentReference createDoc(DocumentReference parent, {String? id}) =>
      parent.collection('carrinho').doc(id);

  static Stream<CarrinhoRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => CarrinhoRecord.fromSnapshot(s));

  static Future<CarrinhoRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => CarrinhoRecord.fromSnapshot(s));

  static CarrinhoRecord fromSnapshot(DocumentSnapshot snapshot) =>
      CarrinhoRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static CarrinhoRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      CarrinhoRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'CarrinhoRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is CarrinhoRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createCarrinhoRecordData({
  DocumentReference? dono,
  double? subtotal,
  double? total,
  double? frete,
  DateTime? dataModif,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'dono': dono,
      'subtotal': subtotal,
      'total': total,
      'frete': frete,
      'data_modif': dataModif,
    }.withoutNulls,
  );

  return firestoreData;
}

class CarrinhoRecordDocumentEquality implements Equality<CarrinhoRecord> {
  const CarrinhoRecordDocumentEquality();

  @override
  bool equals(CarrinhoRecord? e1, CarrinhoRecord? e2) {
    const listEquality = ListEquality();
    return listEquality.equals(e1?.itens, e2?.itens) &&
        e1?.dono == e2?.dono &&
        e1?.subtotal == e2?.subtotal &&
        e1?.total == e2?.total &&
        e1?.frete == e2?.frete &&
        e1?.dataModif == e2?.dataModif;
  }

  @override
  int hash(CarrinhoRecord? e) => const ListEquality()
      .hash([e?.itens, e?.dono, e?.subtotal, e?.total, e?.frete, e?.dataModif]);

  @override
  bool isValidKey(Object? o) => o is CarrinhoRecord;
}
