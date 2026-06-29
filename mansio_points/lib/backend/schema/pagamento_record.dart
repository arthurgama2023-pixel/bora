import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class PagamentoRecord extends FirestoreRecord {
  PagamentoRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "created_at" field.
  DateTime? _createdAt;
  DateTime? get createdAt => _createdAt;
  bool hasCreatedAt() => _createdAt != null;

  // "usuario" field.
  DocumentReference? _usuario;
  DocumentReference? get usuario => _usuario;
  bool hasUsuario() => _usuario != null;

  // "valor" field.
  double? _valor;
  double get valor => _valor ?? 0.0;
  bool hasValor() => _valor != null;

  // "compra" field.
  DocumentReference? _compra;
  DocumentReference? get compra => _compra;
  bool hasCompra() => _compra != null;

  // "quant_itens" field.
  int? _quantItens;
  int get quantItens => _quantItens ?? 0;
  bool hasQuantItens() => _quantItens != null;

  // "qr_Code" field.
  String? _qrCode;
  String get qrCode => _qrCode ?? '';
  bool hasQrCode() => _qrCode != null;

  void _initializeFields() {
    _createdAt = snapshotData['created_at'] as DateTime?;
    _usuario = snapshotData['usuario'] as DocumentReference?;
    _valor = castToType<double>(snapshotData['valor']);
    _compra = snapshotData['compra'] as DocumentReference?;
    _quantItens = castToType<int>(snapshotData['quant_itens']);
    _qrCode = snapshotData['qr_Code'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('pagamento');

  static Stream<PagamentoRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => PagamentoRecord.fromSnapshot(s));

  static Future<PagamentoRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => PagamentoRecord.fromSnapshot(s));

  static PagamentoRecord fromSnapshot(DocumentSnapshot snapshot) =>
      PagamentoRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static PagamentoRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      PagamentoRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'PagamentoRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is PagamentoRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createPagamentoRecordData({
  DateTime? createdAt,
  DocumentReference? usuario,
  double? valor,
  DocumentReference? compra,
  int? quantItens,
  String? qrCode,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'created_at': createdAt,
      'usuario': usuario,
      'valor': valor,
      'compra': compra,
      'quant_itens': quantItens,
      'qr_Code': qrCode,
    }.withoutNulls,
  );

  return firestoreData;
}

class PagamentoRecordDocumentEquality implements Equality<PagamentoRecord> {
  const PagamentoRecordDocumentEquality();

  @override
  bool equals(PagamentoRecord? e1, PagamentoRecord? e2) {
    return e1?.createdAt == e2?.createdAt &&
        e1?.usuario == e2?.usuario &&
        e1?.valor == e2?.valor &&
        e1?.compra == e2?.compra &&
        e1?.quantItens == e2?.quantItens &&
        e1?.qrCode == e2?.qrCode;
  }

  @override
  int hash(PagamentoRecord? e) => const ListEquality().hash([
        e?.createdAt,
        e?.usuario,
        e?.valor,
        e?.compra,
        e?.quantItens,
        e?.qrCode
      ]);

  @override
  bool isValidKey(Object? o) => o is PagamentoRecord;
}
