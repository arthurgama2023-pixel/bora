import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class ComprasRecord extends FirestoreRecord {
  ComprasRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "usuario" field.
  DocumentReference? _usuario;
  DocumentReference? get usuario => _usuario;
  bool hasUsuario() => _usuario != null;

  // "parceiro" field.
  DocumentReference? _parceiro;
  DocumentReference? get parceiro => _parceiro;
  bool hasParceiro() => _parceiro != null;

  // "produtos" field.
  List<DocumentReference>? _produtos;
  List<DocumentReference> get produtos => _produtos ?? const [];
  bool hasProdutos() => _produtos != null;

  // "total" field.
  double? _total;
  double get total => _total ?? 0.0;
  bool hasTotal() => _total != null;

  // "status" field.
  String? _status;
  String get status => _status ?? '';
  bool hasStatus() => _status != null;

  // "status_parceiro" field.
  String? _statusParceiro;
  String get statusParceiro => _statusParceiro ?? '';
  bool hasStatusParceiro() => _statusParceiro != null;

  // "qr_code" field.
  String? _qrCode;
  String get qrCode => _qrCode ?? '';
  bool hasQrCode() => _qrCode != null;

  // "id_pagamento" field.
  String? _idPagamento;
  String get idPagamento => _idPagamento ?? '';
  bool hasIdPagamento() => _idPagamento != null;

  void _initializeFields() {
    _usuario = snapshotData['usuario'] as DocumentReference?;
    _parceiro = snapshotData['parceiro'] as DocumentReference?;
    _produtos = getDataList(snapshotData['produtos']);
    _total = castToType<double>(snapshotData['total']);
    _status = snapshotData['status'] as String?;
    _statusParceiro = snapshotData['status_parceiro'] as String?;
    _qrCode = snapshotData['qr_code'] as String?;
    _idPagamento = snapshotData['id_pagamento'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('compras');

  static Stream<ComprasRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => ComprasRecord.fromSnapshot(s));

  static Future<ComprasRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => ComprasRecord.fromSnapshot(s));

  static ComprasRecord fromSnapshot(DocumentSnapshot snapshot) =>
      ComprasRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static ComprasRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      ComprasRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'ComprasRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is ComprasRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createComprasRecordData({
  DocumentReference? usuario,
  DocumentReference? parceiro,
  double? total,
  String? status,
  String? statusParceiro,
  String? qrCode,
  String? idPagamento,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'usuario': usuario,
      'parceiro': parceiro,
      'total': total,
      'status': status,
      'status_parceiro': statusParceiro,
      'qr_code': qrCode,
      'id_pagamento': idPagamento,
    }.withoutNulls,
  );

  return firestoreData;
}

class ComprasRecordDocumentEquality implements Equality<ComprasRecord> {
  const ComprasRecordDocumentEquality();

  @override
  bool equals(ComprasRecord? e1, ComprasRecord? e2) {
    const listEquality = ListEquality();
    return e1?.usuario == e2?.usuario &&
        e1?.parceiro == e2?.parceiro &&
        listEquality.equals(e1?.produtos, e2?.produtos) &&
        e1?.total == e2?.total &&
        e1?.status == e2?.status &&
        e1?.statusParceiro == e2?.statusParceiro &&
        e1?.qrCode == e2?.qrCode &&
        e1?.idPagamento == e2?.idPagamento;
  }

  @override
  int hash(ComprasRecord? e) => const ListEquality().hash([
        e?.usuario,
        e?.parceiro,
        e?.produtos,
        e?.total,
        e?.status,
        e?.statusParceiro,
        e?.qrCode,
        e?.idPagamento
      ]);

  @override
  bool isValidKey(Object? o) => o is ComprasRecord;
}
