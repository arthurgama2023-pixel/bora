import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class AlugueisRecord extends FirestoreRecord {
  AlugueisRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "id" field.
  String? _id;
  String get id => _id ?? '';
  bool hasId() => _id != null;

  // "titulo" field.
  String? _titulo;
  String get titulo => _titulo ?? '';
  bool hasTitulo() => _titulo != null;

  // "valor" field.
  double? _valor;
  double get valor => _valor ?? 0.0;
  bool hasValor() => _valor != null;

  // "chavePix" field.
  String? _chavePix;
  String get chavePix => _chavePix ?? '';
  bool hasChavePix() => _chavePix != null;

  // "nomeProprietario" field.
  String? _nomeProprietario;
  String get nomeProprietario => _nomeProprietario ?? '';
  bool hasNomeProprietario() => _nomeProprietario != null;

  // "status" field.
  String? _status;
  String get status => _status ?? '';
  bool hasStatus() => _status != null;

  // "isPago" field.
  bool? _isPago;
  bool get isPago => _isPago ?? false;
  bool hasIsPago() => _isPago != null;

  // "dono" field.
  DocumentReference? _dono;
  DocumentReference? get dono => _dono;
  bool hasDono() => _dono != null;

  // "IdPagamento" field.
  String? _idPagamento;
  String get idPagamento => _idPagamento ?? '';
  bool hasIdPagamento() => _idPagamento != null;

  // "QrCode" field.
  String? _qrCode;
  String get qrCode => _qrCode ?? '';
  bool hasQrCode() => _qrCode != null;

  // "PixPG" field.
  String? _pixPG;
  String get pixPG => _pixPG ?? '';
  bool hasPixPG() => _pixPG != null;

  // "dataPagamento" field.
  DateTime? _dataPagamento;
  DateTime? get dataPagamento => _dataPagamento;
  bool hasDataPagamento() => _dataPagamento != null;

  // "dataRepasse" field.
  DateTime? _dataRepasse;
  DateTime? get dataRepasse => _dataRepasse;
  bool hasDataRepasse() => _dataRepasse != null;

  // "pontos" field.
  int? _pontos;
  int get pontos => _pontos ?? 0;
  bool hasPontos() => _pontos != null;

  // "boleto" field.
  String? _boleto;
  String get boleto => _boleto ?? '';
  bool hasBoleto() => _boleto != null;

  // "TipoPagamento" field.
  String? _tipoPagamento;
  String get tipoPagamento => _tipoPagamento ?? '';
  bool hasTipoPagamento() => _tipoPagamento != null;

  // "valorComAdd" field.
  double? _valorComAdd;
  double get valorComAdd => _valorComAdd ?? 0.0;
  bool hasValorComAdd() => _valorComAdd != null;

  // "comprovante" field.
  String? _comprovante;
  String get comprovante => _comprovante ?? '';
  bool hasComprovante() => _comprovante != null;

  void _initializeFields() {
    _id = snapshotData['id'] as String?;
    _titulo = snapshotData['titulo'] as String?;
    _valor = castToType<double>(snapshotData['valor']);
    _chavePix = snapshotData['chavePix'] as String?;
    _nomeProprietario = snapshotData['nomeProprietario'] as String?;
    _status = snapshotData['status'] as String?;
    _isPago = snapshotData['isPago'] as bool?;
    _dono = snapshotData['dono'] as DocumentReference?;
    _idPagamento = snapshotData['IdPagamento'] as String?;
    _qrCode = snapshotData['QrCode'] as String?;
    _pixPG = snapshotData['PixPG'] as String?;
    _dataPagamento = snapshotData['dataPagamento'] as DateTime?;
    _dataRepasse = snapshotData['dataRepasse'] as DateTime?;
    _pontos = castToType<int>(snapshotData['pontos']);
    _boleto = snapshotData['boleto'] as String?;
    _tipoPagamento = snapshotData['TipoPagamento'] as String?;
    _valorComAdd = castToType<double>(snapshotData['valorComAdd']);
    _comprovante = snapshotData['comprovante'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('alugueis');

  static Stream<AlugueisRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => AlugueisRecord.fromSnapshot(s));

  static Future<AlugueisRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => AlugueisRecord.fromSnapshot(s));

  static AlugueisRecord fromSnapshot(DocumentSnapshot snapshot) =>
      AlugueisRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static AlugueisRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      AlugueisRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'AlugueisRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is AlugueisRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createAlugueisRecordData({
  String? id,
  String? titulo,
  double? valor,
  String? chavePix,
  String? nomeProprietario,
  String? status,
  bool? isPago,
  DocumentReference? dono,
  String? idPagamento,
  String? qrCode,
  String? pixPG,
  DateTime? dataPagamento,
  DateTime? dataRepasse,
  int? pontos,
  String? boleto,
  String? tipoPagamento,
  double? valorComAdd,
  String? comprovante,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'id': id,
      'titulo': titulo,
      'valor': valor,
      'chavePix': chavePix,
      'nomeProprietario': nomeProprietario,
      'status': status,
      'isPago': isPago,
      'dono': dono,
      'IdPagamento': idPagamento,
      'QrCode': qrCode,
      'PixPG': pixPG,
      'dataPagamento': dataPagamento,
      'dataRepasse': dataRepasse,
      'pontos': pontos,
      'boleto': boleto,
      'TipoPagamento': tipoPagamento,
      'valorComAdd': valorComAdd,
      'comprovante': comprovante,
    }.withoutNulls,
  );

  return firestoreData;
}

class AlugueisRecordDocumentEquality implements Equality<AlugueisRecord> {
  const AlugueisRecordDocumentEquality();

  @override
  bool equals(AlugueisRecord? e1, AlugueisRecord? e2) {
    return e1?.id == e2?.id &&
        e1?.titulo == e2?.titulo &&
        e1?.valor == e2?.valor &&
        e1?.chavePix == e2?.chavePix &&
        e1?.nomeProprietario == e2?.nomeProprietario &&
        e1?.status == e2?.status &&
        e1?.isPago == e2?.isPago &&
        e1?.dono == e2?.dono &&
        e1?.idPagamento == e2?.idPagamento &&
        e1?.qrCode == e2?.qrCode &&
        e1?.pixPG == e2?.pixPG &&
        e1?.dataPagamento == e2?.dataPagamento &&
        e1?.dataRepasse == e2?.dataRepasse &&
        e1?.pontos == e2?.pontos &&
        e1?.boleto == e2?.boleto &&
        e1?.tipoPagamento == e2?.tipoPagamento &&
        e1?.valorComAdd == e2?.valorComAdd &&
        e1?.comprovante == e2?.comprovante;
  }

  @override
  int hash(AlugueisRecord? e) => const ListEquality().hash([
        e?.id,
        e?.titulo,
        e?.valor,
        e?.chavePix,
        e?.nomeProprietario,
        e?.status,
        e?.isPago,
        e?.dono,
        e?.idPagamento,
        e?.qrCode,
        e?.pixPG,
        e?.dataPagamento,
        e?.dataRepasse,
        e?.pontos,
        e?.boleto,
        e?.tipoPagamento,
        e?.valorComAdd,
        e?.comprovante
      ]);

  @override
  bool isValidKey(Object? o) => o is AlugueisRecord;
}
